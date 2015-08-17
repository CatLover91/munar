const SekshiModule = require('../Module')
const command = require('../command')
const sekshibot = require('../../package.json')
const plugged = require('plugged/package.json')
const mongoose = require('mongoose/package.json')

export default class System extends SekshiModule {

  constructor(sekshi, options) {
    super(sekshi, options)

    this.author = 'Sooyou'
    this.description = 'Simple tools for module management & system information'
  }

  manager() {
    return this.sekshi.modules
  }

  @command('version')
  version(user) {
    const str = pkg => `${pkg.name} v${pkg.version}`
    this.sekshi.sendChat(
      `@${user.username} Running ${str(sekshibot)} on ${str(plugged)}, ${str(mongoose)}`
    )
  }

  @command('reloadmodule', 'reload', { role: command.ROLE.MANAGER })
  reloadmodule(user, name) {
    try {
      this.manager().reload(name)
      this.sekshi.sendChat(`@${user.username} Reloaded module "${name}".`)
    }
    catch (e) {
      this.sekshi.sendChat(`@${user.username} Could not reload "${name}": ${e.message}`)
    }
  }

  @command('unloadmodule', 'unload', { role: command.ROLE.MANAGER })
  unloadmodule(user, name) {
    try {
      this.manager().unload(name)
      this.sekshi.sendChat(`@${user.username} Unloaded module "${name}."`)
    }
    catch (e) {
      this.sekshi.sendChat(`@${user.username} Could not unload "${name}": ${e.message}`)
    }
  }
  @command('loadmodule', 'load', { role: command.ROLE.MANAGER })
  loadmodule(user, name) {
    try {
      this.manager().load(name)
      this.sekshi.sendChat(`@${user.username} Loaded module "${name}".`)
    }
    catch (e) {
      this.sekshi.sendChat(`@${user.username} Could not load "${name}": ${e.message}`)
    }
  }

  @command('disablemodule', 'disable', { role: command.ROLE.MANAGER })
  disablemodule(user, name) {
    if (name.toLowerCase() === 'system') {
      this.sekshi.sendChat(`@${user.username} Cannot disable the System module.`)
    }
    else {
      const mod = this.manager().get(name)
      if (mod) {
        mod.disable()
        this.sekshi.sendChat(`@${user.username} Module "${name}" disabled.`)
      }
      else {
        this.sekshi.sendChat(`@${user.username} Could not find the "${name}" module.`)
      }
    }
  }
  @command('enablemodule', 'enable', { role: command.ROLE.MANAGER })
  enablemodule(user, name) {
    let mod = this.manager().get(name)
    if (!mod) {
      try {
        mod = this.manager().load(name)
      }
      catch (e) {
        console.error(e)
        return this.sekshi.sendChat(`@${user.username} Could not load the "${name}" module.`)
      }
    }
    mod.enable()
    this.sekshi.sendChat(`@${user.username} Module "${name}" enabled.`)
  }

  @command('moduleinfo', { role: command.ROLE.MANAGER })
  moduleinfo(user, name) {
    if(!name || name.length === 0) {
        this.sekshi.sendChat(`usage: !moduleinfo "modulename"`)
        return;
    }

    const mod = this.manager().get(name)
    if (mod) {
      [ `:small_blue_diamond: Module info for "${name}"`,
        `:white_small_square: Status: ${mod.enabled() ? 'enabled' : 'disabled'}`,
        `:white_small_square: Author: ${mod.author}`,
        `:white_small_square: Description: ${mod.description}`,
      ].forEach(this.sekshi.sendChat, this.sekshi)
    }
    else {
      this.sekshi.sendChat(`@${user.username} Module "${name}" does not exist.`);
    }
  }

  @command('listmodules', { role: command.ROLE.MANAGER })
  listmodules(user) {
    const text = this.manager().known().map(name => {
      const mod = this.manager().get(name)
      return `${name} ${mod && mod.enabled() ? '✔' : '✘'}`
    })
    this.sekshi.sendChat(text.sort().join(', '), 20 * 1000)
  }

  @command('exit', { role: command.ROLE.MANAGER })
  exit(user) {
    this.sekshi.sendChat(`@${user.username} okay... </3 T_T`)
    this.sekshi.stop()
  }
}
