import { Module, command } from '../'
import Media from '../models/Media'
import HistoryEntry from '../models/HistoryEntry'
import moment from 'moment'
import * as utils from '../utils'

export default class MediaStats extends Module {
  author = 'ReAnna'
  description = 'Provides staff with some statistics on media plays.'

  source = this.adapter('uwave').getChannel('main')

  // public API
  async getRecentPlays (media, span = 'w') {
    const query = typeof media === 'string'
      ? { cid: media }
      : { cid: media.cid }

    const since = utils.spanToTime(span)
    const currentStart = moment.utc(this.bot.getStartTime(), 'YYYY-MM-DD HH:mm:ss')
    const mediaModel = await Media.findOne(query)

    return await HistoryEntry.find({ media: mediaModel.id })
      .where('time').gte(since.toDate()).lt(currentStart.toDate())
      .sort('+time')
      .populate('dj')
  }

  async getMostPlayed (amount = 3, time = 'f') {
    const since = utils.spanToTime(time)
    // find most played songs
    const mostPlayed = await HistoryEntry.aggregate()
      .match({ time: { $gte: since.toDate() } })
      .group({ _id: '$media', count: { $sum: 1 } })
      .sort('-count _id')
      .project('_id count')
      .limit(amount)

    // find media documents for the most played songs
    const mediaIds = mostPlayed.map((hist) => hist._id)
    const playcounts = {}
    mostPlayed.forEach((h) => {
      playcounts[h._id] = h.count
    })

    const medias = await Media.where('_id').in(mediaIds).lean()
    medias.forEach((m) => {
      m.plays = playcounts[m._id]
    })

    return medias.sort((a, b) => a.plays > b.plays ? -1 : 1) // good enough!
  }

  async getLastPlay (media) {
    const query = typeof media === 'string'
      ? { cid: media }
      : { cid: media.cid }

    const currentStart = moment.utc(this.bot.getStartTime(), 'YYYY-MM-DD HH:mm:ss')
    const mediaModel = await Media.findOne(query).lean()
    return await HistoryEntry.findOne({ media: mediaModel._id })
      .where('time').lt(currentStart.toDate())
      .sort('-time')
      .populate('dj')
  }

  // chat commands
  @command('lastplayed')
  async lastplayed (message) {
    const currentMedia = this.bot.getCurrentMedia()
    if (!currentMedia) return
    const mostRecent = await this.getLastPlay(currentMedia)
    if (mostRecent) {
      let text = `This song was played ${moment(mostRecent.time).fromNow()}`
      if (mostRecent.dj) text += ` by ${mostRecent.dj.username}`
      message.reply(`${text}.`)
    } else {
      message.reply('This song hasn\'t been played before.')
    }
  }

  @command('playcount')
  async playcount (message, span = 'w') {
    const hours = moment().diff(utils.spanToTime(span), 'hours')
    const allTime = span === 'f'
    const currentMedia = this.bot.getCurrentMedia()
    if (!currentMedia) {
      return
    }
    const results = await this.getRecentPlays(currentMedia, span)
    const playcount = results.length

    if (playcount > 0) {
      const mostRecent = results[results.length - 1]

      let text = `This song was played ${utils.times(playcount)}`
      if (!allTime) {
        text += ` over the past ${utils.days(hours)}`
      }
      text += `, most recently ${moment(mostRecent.time).utc().fromNow()}`
      if (mostRecent.dj) {
        text += ` by ${mostRecent.dj.username}`
      }

      message.reply(`${text}.`)
    } else {
      message.reply(
        'This song hasn\'t been played ' +
        (allTime ? 'before.' : `in the last ${utils.days(hours)}.`)
      )
    }
  }

  @command('mostplayed', { role: command.ROLE.RESIDENTDJ })
  async mostplayed (message, amount = 3, time = 'f') {
    // !mostplayed can take 1, 2, or no parameters.
    // without parameters, it shows the top 3 most played songs
    // ever. With one parameter, it shows the top N most played
    // songs ever, *except* if the parameter is a letter (d, w, m, f),
    // in which case it shows the top 3 most played songs over the
    // given time span. With two parameters, it shows the top N
    // most played songs over the given time span.
    //   !mostplayed
    //   !mostplayed 5
    //   !mostplayed w
    //   !mostplayed 5 d
    if (typeof amount === 'string' && /^\d+$/.test(amount)) {
      amount = parseInt(amount, 10)
    }
    // !mostplayed (d|w|m|f)
    if (typeof amount === 'string') {
      time = amount
      amount = 3
    }

    const since = utils.spanToTime(time)
    const hours = moment().diff(since, 'hours')
    const allTime = time === 'f'
    // find most played songs
    let response = 'Most played songs'
    if (!allTime) response += ` over the last ${utils.days(hours)}`
    response += ':\n'
    const mostPlayed = await this.getMostPlayed(amount, time)
    response += mostPlayed.map((m, i) => {
      return `#${i + 1} - ${m.author} - ${m.title} (${m.plays} plays)`
    }).join('\n')
    message.reply(response)
  }

  @command('tagged', { role: command.ROLE.RESIDENTDJ })
  async tagged (message, cid) {
    if (!cid) {
      let media = this.bot.getCurrentMedia()
      if (!media) return
      cid = media.cid
    }
    const model = await Media.findOne({ cid: cid })
    message.reply(`"${model.author}" - "${model.title}"`)
  }

  @command('retag', { role: command.ROLE.RESIDENTDJ, ninjaVanish: true })
  async retag (message, cid, ...newTag) {
    let author
    let title
    let media = await Media.findOne({ cid: cid }).lean()
    if (!media) {
      media = this.bot.getCurrentMedia()
      newTag.unshift(cid)
    }
    if (!media) return

    newTag = newTag.join(' ')

    if (newTag.length === 0) {
      let fixed = utils.fixTags(media)
      author = fixed.author
      title = fixed.title
    } else {
      let split = newTag.indexOf(' - ')
      author = newTag.slice(0, split)
      title = newTag.slice(split + 3)
    }

    if (!author) {
      return message.reply('Please provide a valid artist name.')
    }
    if (!title) {
      return message.reply('Please provide a valid song title.')
    }

    await Media.update({ cid: media.cid }, { $set: { author, title } })
    message.reply(`Song retagged to "${author}" - "${title}"!`, 5000)
  }
}
