import { createServer } from 'http'
import { Plugin } from 'munar-core'
import micro, { createError } from 'micro'

export default class Serve extends Plugin {
  static defaultOptions = {
    port: 3000
  }

  enable () {
    this.server = micro(this.onRequest)

    this.server.listen(this.options.port)
  }

  disable () {
    this.server.close()
  }

  onRequest = async (req, res) => {
    const pluginName = req.url.split('/')[1]
    const plugin = await this.bot.getPlugin(pluginName)

    if (!plugin || typeof plugin.serve !== 'function') {
      throw createError(404, 'That plugin does not exist or does not expose a web interface.')
    }

    // Remove plugin name from the URL.
    const parts = req.url.split('/')
    parts.splice(1, 1)
    req.url = parts.join('/')

    return plugin.serve(req, res, {
      send: micro.send,
      sendError: micro.sendError,
      createError: micro.createError,
      json: micro.json
    })
  }
}
