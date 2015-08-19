const SekshiModule = require('../Module')
const command = require('../command')
const debug = require('debug')('sekshi:config')

const configCommands = [ 'set', 'get', 'add', 'remove' ]

export default class Config extends SekshiModule {

  constructor(sekshi, options) {
    super(sekshi, options)

    this.author = 'ReAnna'
    this.description = 'Keeps module configuration.'

    this.subPerms = {
      set: sekshi.USERROLE.MANAGER,
      get: sekshi.USERROLE.BOUNCER,
      add: sekshi.USERROLE.MANAGER,
      remove: sekshi.USERROLE.MANAGER
    }
  }

  @command('set', { role: command.ROLE.MANAGER })
  setCommand(user, ns, option, value) {
    this.config(user, 'set', ns, option, value)
  }

  @command('get', { role: command.ROLE.MANAGER })
  getCommand(user, ns, option, value) {
    this.config(user, 'get', ns, option, value)
  }

  set(user, ns, option, value) {
    let mod = this.sekshi.getModule(ns)
    if (/^[0-9]+$/.test(value)) value = parseInt(value, 10)
    if (/^true|false$/.test(value)) value = value === 'true'
    debug('value', typeof value, value)
    mod.setOption(option, value)
    this.sekshi.sendChat(`@${user.username} "${ns}.${option}" set to ${value}`)
  }

  get(user, ns, option) {
    let mod = this.sekshi.getModule(ns)
    if (option) {
      this.sekshi.sendChat(`@${user.username} "${ns}.${option}": ${mod.getOption(option)}`)
    }
    else {
      let options = mod.getOptions()
      debug('all options', options)
      for (var option in options) {
        this.sekshi.sendChat(`@${user.username} ${ns}.${option}: ${options[option]}`)
      }
    }
  }

  add(user, ns, option, ...values) {
    let mod = this.sekshi.getModule(ns)
    let arr = mod.getOption(option)
    if (arr == null)             arr = values
    else if (Array.isArray(arr)) arr = arr.concat(values)
    else {
      this.sekshi.sendChat(`@${user.username} "${ns}.${option}" is not a list.`)
      return
    }
    mod.setOption(option, arr)
    this.sekshi.sendChat(`@${user.username} added values to "${ns}.${option}".`)
  }
  remove(user, ns, option, ...values) {
    let mod = this.sekshi.getModule(ns)
    let arr = mod.getOption(option)
    if (Array.isArray(arr)) arr = arr.filter(val => values.indexOf(val) === -1)
    else {
      this.sekshi.sendChat(`@${user.username} "${ns}.${option}" is not a list.`)
      return
    }
    mod.setOption(option, arr)
    this.sekshi.sendChat(`@${user.username} removed values from "${ns}.${option}".`)
  }

  @command('config', 'cf', { role: command.ROLE.MANAGER })
  config(user, command, ns, ...args) {
    if (configCommands.indexOf(command) === -1) {
      this.sekshi.sendChat(`@${user.username} "${command}" is not a command.`)
      return
    }
    if (!ns) {
      this.sekshi.sendChat(`@${user.username} You should provide a module to configure.`)
    }

    let mod = this.sekshi.getModule(ns)
    if (!mod) {
      this.sekshi.sendChat(`@${user.username} Could not find module "${ns}".`)
      return
    }

    this[command](user, ns, ...args)
  }

}
