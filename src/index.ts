import joplin from 'api';
import { ToolbarButtonLocation } from 'api/types';
import Settings from "./settings";

import HmdAPI from '@hackmd/api'

const hmdMarkPrefix = "HackMD Note URL";
const shareButton = "share"

joplin.plugins.register({

    onStart: async function () {

        Settings.init();

        joplin.commands.register({
            name: shareButton,
            label: 'Share on HackMD',
            iconName: 'fa fa-share-alt',
            execute: async () => {
                const note = await joplin.workspace.selectedNote();
                if (!note) {
                    console.warn("Note isn't selected");
                    return;
                }

                if (note.body.includes(hmdMarkPrefix)) {
                    joplin.views.dialogs.showMessageBox("Note already shared on HackMD, check footer part of your note for HackMD link,"
                        + " or remove that part to share on HackMD again."
                        + " Note updating is expected in the next version of the plugin");
                    return;
                }

                // 判断token，url是否为空
                let token: string = await Settings.getToken();
                let url: string = await Settings.getUrl();

                if (!token || !url) {
                    joplin.views.dialogs.showMessageBox("HackMD token or url is empty! Check HackMD settings")
                    return;
                }
                // 创建 HmdAPI 实例
                console.debug("[HackMD] Creating new web-client");
                let hmdApiClient = new HmdAPI(token, url);

                // 笔记
                hackmdNote(hmdApiClient, note);
            },
        });

        joplin.views.toolbarButtons.create(shareButton, shareButton, ToolbarButtonLocation.EditorToolbar);
    },

});

// 异常
async function hackmdNote(hmdApiClient, note) {
    try {
        //分享笔记
        console.log(note);
        await createHackmdNote(hmdApiClient, note);
    } catch (error) {
        joplin.views.dialogs.showMessageBox(error);
        return;
    }
}

// 创建笔记
async function createHackmdNote(hmdApiClient: any, note: any) {
    console.debug("[HackMD] Creating note...");
    // Set note name (Title)
    let remoteBody: string = note.body;
    if (!remoteBody.trim().startsWith("# ")) {
        remoteBody = `# ${note.title}\n${remoteBody}`;
    }

    // Set tags (if any)
    let tags: Object = await joplin.data.get(['notes', note.id, 'tags']);
    if (tags && tags['items'] && tags['items'].length > 0) {
        let tagsText = "###### tags:";
        tags['items'].forEach(tag => {
            tagsText += ` \`${tag.title}\``;
        });
        remoteBody = remoteBody.replace(/^(#.*\n)/gm, `$1\n${tagsText}\n\n`);
    }

    // 添加一个字段，字段名不一致
    note.content = remoteBody

    let note_publishLink = await hmdApiClient.createNote(note);
    console.log("[HackMD] New note url:", note_publishLink.publishLink);
    // Updating Joplin local note body
    let newBody = `${note.body} \n\n ----- \n ${hmdMarkPrefix}: ${note_publishLink.publishLink}`;
    await joplin.data.put(['notes', note.id], null, { body: newBody, source_url: note_publishLink.publishLink });
    await joplin.commands.execute('editor.setText', newBody);
    await joplin.commands.execute('focusElement', 'noteBody');
}
