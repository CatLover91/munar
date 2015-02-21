const assign = require('object-assign')
const SekshiModule = require('../Module')

export default class ModSkip extends SekshiModule {

  constructor(sekshi, options) {
    this.name = 'ModSkip'
    this.author = 'ReAnna'
    this.version = '0.2.0'
    this.description = 'Simple DJ skipping tools'

    super(sekshi, options)

    this.permissions = {
      skip: sekshi.USERROLE.BOUNCER,
      lockskip: sekshi.USERROLE.BOUNCER
    }
  }

  defaultOptions() {
    return {
      reasons: {
        kpop: 'This is a Korean music dedicated room, please only play music by Korean artists.',
        history: 'This song is in the history. Please pick another.',
        duration: 'This song is too long. Please pick a shorter one.'
      },
      lockskipPos: 1
    }
  }

  _skipMessage(user, reason = false) {
    if (reason && this.options.reasons.hasOwnProperty(reason)) {
      reason = this.options.reasons[reason]
    }
    if (reason) {
      let dj = this.sekshi.getCurrentDJ()
      return `@${dj.username} ${reason}`
    }
    else {
      return `/me ${user.username} used skip!`
    }
  }

  skip(user, reason) {
    this.sekshi.sendChat(this._skipMessage(user, reason))
    this.sekshi.skipDJ(this.sekshi.getCurrentDJ().id)
  }

  lockskip(user, reason) {
    this.sekshi.sendChat(this._skipMessage(user, reason))
    this.sekshi.lockskipDJ(this.sekshi.getCurrentDJ().id, this.options.lockskipPos)
  }

}