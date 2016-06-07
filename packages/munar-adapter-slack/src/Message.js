import { Message } from 'munar-core'

export default class SlackMessage extends Message {
  get user () {
    return this.source.getUser(this.sourceMessage.user)
  }

  get username () {
    return this.user.username
  }

  delete () {
    this.sourceMessage.deleteMessage()
  }
}
