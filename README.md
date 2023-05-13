> 似乎已经不再更新了，暂时替代  
>原仓库：[xardbaiz/hackmd](https://github.com/xardbaiz/joplin-plugin-hackmd/)
# Joplin -> HackMD
HackMD Joplin Plugin is an *unofficial* plugin to extend the export tools of [Joplin's](https://joplinapp.org/) desktop application.

It allows sharing notes online on the HackMD website

## Features
- Saves HackMD user credentials in secured store
- Uploads note online using HackMD website (one-way share: Joplin :arrow_right: HackMD)
	>  - Content: {temporary} text only _(see 'Roardmap')_
	>  - Access for a new note by default: read - everyone; write - owner only;

#### RoadMap:
 - Share a note with specified name _([PR](https://github.com/hackmdio/api-client/pull/14) to SDK already raised)_
 - Share with pictures
 - Bulk share
 - Continuous syncing  _(one-way periodical sync Joplin :arrow_right: HackMD)_

## Installation
### Automatic _(Joplin v1.6.4 and newer)_
- Open Joplin and navigate to `Tools > Options > Plugins`
- Search for the plugin name and press install
- Restart Joplin to enable the plugin

### Manual
- Download the latest released JPL package (`*.jpl`) from [here](https://github.com/xardbaiz/joplin-plugin-hackmd/releases/)
- Open Joplin and navigate to `Tools > Options > Plugins`
- Press `Install plugin` and select the previously downloaded `jpl` file
- Confirm selection
- Restart Joplin to enable the plugin

### Uninstall
- Open Joplin and navigate to `Tools > Options > Plugins`
- Search for the plugin name and press `Delete` to remove the plugin completely
  - Alternatively you can also disable the plugin by clicking on the toggle button
- Restart Joplin

## Usage
### Register on [HackMD.io](https://hackmd.io)

![](docs/Snipaste_2023-05-11_08-43-48.png)

### Fill HackMD plugin settings
Open `Tools > Options > HackMD sync` and fill username & password fields

![HackMD sync settings|571x227, 75%](docs/Snipaste_2023-05-11_08-35-56.png)


### Share
Select target note and press the `Share on HackMD` button

![Share button|671x65, 75%](docs/Share_button.png)

![](docs/Snipaste_2023-05-13_19-56-11.png)

Wait. If everything is ok - note body will contain link to note on HackMD

![Result with HackMD link|566x65, 75%](docs/Snipaste_2023-05-13_19-57-37.png)

![](docs/Snipaste_2023-05-11_08-41-54.png)

![](docs/Snipaste_2023-05-13_19-59-38.png)

## Support
**Best support is contribution** \
You like this plugin as much as I do and it improves your daily work with Joplin?
Then I would be very happy if you buy me a :coffee: via [PayPal](https://paypal.me/xardbaiz) :wink:

## Contributing
Contributions to this plugin are most welcome. Feel free to open a pull request or an issue.
Make sure to use conventional [commit messages](https://github.com/pvdlg/conventional-commit-types) if you're creating a pull request.

### Building the plugin
If you want to build the plugin by your own simply run `npm run dist`.

### Updating the plugin framework
To update the plugin framework, run `npm run update`. 
