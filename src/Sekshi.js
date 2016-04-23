import EventEmitter from 'events'
import path from 'path'
import mongoose from 'mongoose'
import Promise from 'bluebird'
import includes from 'array-includes'
import mkdirp from 'mkdirp'
import User from './models/User'
import PluginManager from './PluginManager'
import escapeStringRegExp from 'escape-string-regexp'
import Ultron from 'ultron'

const debug = require('debug')('sekshi:sekshi')

mongoose.Promise = Promise

const attachedAdapterEventsSymbol = Symbol('attached adapter events')

export default class Sekshi extends EventEmitter {
  constructor (options) {
    super()
    this.options = options
    this.db = mongoose.connect(options.mongo)

    this.plugins = new PluginManager(this, path.join(__dirname, 'modules'))
    this.adapters = {}
    this.trigger = options.trigger || '!'

    this._configDir = path.join(__dirname, '../.config')
  }

  adapter (SourceAdapter, options) {
    const name = SourceAdapter.adapterName
    const adapter = new SourceAdapter(this, options)
    this.adapters[name] = adapter
  }

  getAdapter (name) {
    return this.adapters[name]
  }

  async start (creds, cb) {
    await Promise.all(
      Object.keys(this.adapters).map((adapterName) => {
        const adapter = this.adapters[adapterName]
        return adapter.connect()
      })
    )

    Object.keys(this.adapters).map((adapterName) => {
      this.attachAdapter(this.adapters[adapterName])
    })

    this.loadPlugins()
    mkdirp(this._configDir, (e) => {
      if (cb) cb(e || null)
    })

    // the event is fired on nextTick so plugins can simply listen for "pluginloaded"
    // and get events for *all* the plugins when loadPlugins() is called, even for those
    // that register earlier
    this.plugins.on('load', (mod, name) => {
      setImmediate(() => { this.emit('pluginloaded', mod, name) })
    })
    this.plugins.on('unload', (mod, name) => {
      setImmediate(() => { this.emit('pluginunloaded', mod, name) })
    })
  }

  stop (cb) {
    this.unloadPlugins()

    Object.keys(this.adapters).map((adapterName) => {
      const adapter = this.adapters[adapterName]
      this.detachAdapter(adapter)
      return adapter.disconnect()
    })

    // should *probably* also wait for this before callback-ing
    mongoose.disconnect()

    this.once(this.LOGOUT_SUCCESS, () => {
      this.removeAllListeners()
      if (cb) {
        cb()
      }
    })
    this.once(this.LOGOUT_ERROR, (e) => {
      // TODO figure out something useful to do here
      this.removeAllListeners()
      if (cb) {
        cb(e)
      }
    })
  }

  attachAdapter (adapter) {
    const events = new Ultron(adapter)
    events.on('message', this.onMessage)
    events.on('user:join', (user) => {
      this.emit('user:join', user)
    })
    events.on('user:leave', (user) => {
      this.emit('user:leave', user)
    })
    adapter[attachedAdapterEventsSymbol] = events
  }

  detachAdapter (adapter) {
    if (attachedAdapterEventsSymbol in adapter) {
      adapter[attachedAdapterEventsSymbol].remove()
      adapter[attachedAdapterEventsSymbol] = null
    }
  }

  // Find a user model or default to something.
  // Useful for commands that can optionally take a target user.
  findUser (name, _default = null) {
    if (!name) {
      return _default
        ? Promise.resolve(_default)
        : Promise.reject(new Error('No user given'))
    }

    let promise
    let user = this.getUserByName(name)
    if (user) {
      promise = User.findById(user.id)
    } else {
      name = name.replace(/^@/, '')
      let rx = new RegExp(`^${escapeStringRegExp(name)}$`, 'i')
      promise = User.findOne({ username: rx })
    }
    return promise.then((user) => {
      return user || Promise.reject(new Error('User not found'))
    })
  }

  onMessage = (message) => {
    this.emit('message', message)
    if (message.text && message.text.startsWith(this.trigger)) {
      this.executeMessage(message)
        .catch((e) => message.reply(`Error: ${e.message}`))
    }
  }

  executeMessage (message) {
    const { source } = message

    let args = this.parseArguments(message)
    let commandName = args.shift().replace(this.trigger, '').toLowerCase()

    async function tryCommand (pluginName) {
      const plugin = this.plugins.get(pluginName)
      if (!plugin || !plugin.enabled() || !Array.isArray(plugin.commands)) {
        return
      }

      const command = plugin.commands.find(
        (com) => includes(com.names, commandName)
      )
      if (!command) return

      if (command.ninjaVanish && message) {
        message.delete()
      }

      if (source.canExecute(message)) {
        if (command.method) {
          await plugin[command.method](message, ...args)
        } else {
          await command.callback.call(plugin, message, ...args)
        }
      } else {
        throw new Error('You cannot use this command.')
      }
    }

    return Promise.all(
      this.plugins.loaded().map(tryCommand, this)
    )
  }

  // Parses space-separated chat command arguments.
  // single words become single arguments.
  //    word → [ 'word ']
  // strings surrounded by double quotes become single arguments.
  //    "quoted words" word → [ 'quoted words', 'word' ]
  // strings prefixed with "@" are matched to the online user list.
  // if any online user's name matches the string, it will be passed instead.
  // this is so that you don't need quotes around usernames with spaces.
  //    @Online User parameter @Offline User → [ 'Online User', 'parameter', '@Offline', 'User' ]
  //
  // feature-bugs:
  // if you forget to close a quoted string it will go until the end of the line (might be unexpected)
  // if you forget to add a space after a quoted string, the rest will be read as a separate parameter
  parseArguments (message) {
    let args = []
    let i = 0
    let chunk
    const str = message.text || ''
    const source = message.source

    let usernames = str.indexOf('@') !== -1 // might contain a username
      ? source.getUsers().map((user) => user.username)
          // longest usernames first
          .sort((a, b) => a.length > b.length ? -1 : 1)
      : []

    while ((chunk = str.slice(i))) {
      // separator
      if (chunk.charAt(0) === ' ') {
        i++
        continue
      } else if (chunk.charAt(0) === '"') {
        // quoted string
        let end = chunk.indexOf('"', 1)
        // end of param string
        if (end === -1) {
          args.push(chunk.slice(1))
          break
        }
        args.push(chunk.slice(1, end))
        i += end + 1
        continue
      } else if (chunk.charAt(0) === '@') {
        // possible username
        let username = usernames.find(
          (name) => chunk.slice(1, name.length + 1).toLowerCase() === name.toLowerCase()
        )
        if (username) {
          args.push(username)
          i += `@${username}`.length
          continue
        }
      }
      // single parameter word
      let end = chunk.indexOf(' ')
      // end of param string
      if (end === -1) {
        args.push(chunk)
        break
      }
      args.push(chunk.slice(0, end))
      i += end + 1
      continue
    }

    return args
  }

  getPlugin (name) {
    return this.plugins.get(name)
  }

  loadPlugins () {
    debug('load all')
    this.plugins.update()
      .each((name) => this.plugins.load(name))
  }

  unloadPlugins () {
    debug('unload all')
    this.plugins.loaded()
      .forEach((name) => this.plugins.unload(name))
  }

  getConfigDir () {
    return this._configDir
  }
}
