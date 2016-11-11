import { Plugin } from 'munar-core'

export default class DetectNSFW extends Plugin {
  static description = 'Informs user if image is possibly NSFW.'
  
  static defaultOptions = {
    NSFWChanceThreshhold: 0.5
  }
  enable () {
    this.bot.on('message', this.onMessage)
  }

  disable () {
    this.bot.removeListener('message', this.onMessage)
  }

  isPossiblyNSFW (message) {
    return 0;
  }

  onMessage = (message) => {
    NSFWChance = isPossiblyNSFW(message.text)
    
    replyText = 'This image has a ' + (NSFWChance * 100).toFixed() + '% chance of being NSFW'

    if(NSFWChance > defaultOptions.NSFWChanceThreshhold)
      setTimeout(() => {
        message.reply(replyText
      }, 2 * 1000)
  }
} 
