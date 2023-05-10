import joplin from 'api';
import { ToolbarButtonLocation } from 'api/types';
import Settings from "./settings";

import HmdAPI from '@hackmd/api'

const hmdIdMarkPrefix = "HackMD Note ID";
const shareButton = "share"
let hmdApiClient;

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
                console.log(note)
                // 判断token，url是否为空
                let token: string = await Settings.getToken();
                let url: string = await Settings.getUrl();

                if (!token || !url) {
                    joplin.views.dialogs.showMessageBox("HackMD token or url is empty! Check HackMD settings")
                    return;
                }
                // 创建 HmdAPI 实例
                console.debug("[HackMD] Creating new web-client");
                if (!hmdApiClient) {
                    hmdApiClient = new HmdAPI(token, url);
                }
                let result_id = "create";
                if (note.body.includes(hmdIdMarkPrefix)) {
                    const hackmdDialogs = joplin.views.dialogs
                    const handle = await hackmdDialogs.create('hackmdDialog');
                    await hackmdDialogs.setHtml(handle, '<div><p>Note already shared on HackMD, check footer part of your note for HackMD link,<br>or remove that part to share on HackMD again.<br>Note updating is expected in the next version of the plugin </p></div>');
                    await hackmdDialogs.setButtons(handle, [
                        {
                            id: 'update',
                            title: 'update'
                        },
                        {
                            id: 'delete',
                            title: 'delete'
                        },
                        {
                            id: 'cancel'
                        },
                    ]);
                    result_id = (await hackmdDialogs.open(handle)).id;
                    console.debug("after", result_id);
                }
                // 笔记
                await hackmdNote(hmdApiClient, note, result_id);
            },
        });

        joplin.views.toolbarButtons.create(shareButton, shareButton, ToolbarButtonLocation.EditorToolbar);
    },

});

// 异常
async function hackmdNote(hmdApiClient, note, id) {
    try {
        //分享笔记
        switch (id) {
            case 'update':
                // 执行更新操作
                await updateHackmdNote(hmdApiClient, note);
                break;
            case 'delete':
                // 执行删除操作
                await deleteHackmdNote(hmdApiClient, note);
                break;
            case 'cancel':
                // 取消操作
                break;
            default:
                await createHackmdNote(hmdApiClient, note);
                break;
        }
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
    const tags: Object = await joplin.data.get(['notes', note.id, 'tags']);
    if (tags && tags['items'] && tags['items'].length > 0) {
        let tagsText = "###### tags:";
        tags['items'].forEach(tag => {
            tagsText += ` \`${tag.title}\``;
        });
        remoteBody = remoteBody.replace(/^(#.*\n)/gm, `$1\n${tagsText}\n\n`);
    }

    const { id, publishLink } = await hmdApiClient.createNote({
        title: note.title,
        content: remoteBody,
        text: note.body
    });

    // let note_publishLink = await hmdApiClient.createNote(note);
    console.log("[HackMD] New note url:", publishLink);
    // Updating Joplin local note body
    let newBody = `${note.body} \n\n ----- \n ${hmdIdMarkPrefix}: ${id}`;
    await joplin.data.put(['notes', note.id], null, { body: newBody, source_url: publishLink });
    await joplin.commands.execute('editor.setText', newBody);
    await joplin.commands.execute('focusElement', 'noteBody');
}

// 更新笔记
async function updateHackmdNote(hmdApiClient: any, note: any) {
    console.debug("[HackMD] Update note...");

    // Set note name (Title)
    let remoteBody: string = note.body;
    if (!remoteBody.trim().startsWith("# ")) {
        remoteBody = `# ${note.title}\n${remoteBody}`;
    }

    //hackmd笔记id
    const hmdIdMark = getHackmdNoteInfo(note.body, hmdIdMarkPrefix);
    // Set tags (if any)
    const tags: Object = await joplin.data.get(['notes', note.id, 'tags']);
    if (tags && tags['items'] && tags['items'].length > 0) {
        let tagsText = "###### tags:";
        tags['items'].forEach(tag => {
            tagsText += ` \`${tag.title}\``;
        });
        remoteBody = remoteBody.replace(/^(#.*\n)/gm, `$1\n${tagsText}\n\n`);
    }

    const newText = removeLastTwoLines(remoteBody);
    hmdApiClient.updateNoteContent(hmdIdMark, newText);
    //存在一点问题，如果在同时修改了tag和文本的情况下，会导致，只修改了tag，文本为未修改前，需要再次更新
    console.log(hmdIdMark, newText);
}

// 删除笔记
async function deleteHackmdNote(hmdApiClient: any, note: any) {
    console.debug("[HackMD] delete note...");

    //hackmd笔记id
    const hmdIdMark = getHackmdNoteInfo(note.body, hmdIdMarkPrefix);
    hmdApiClient.deleteNote(hmdIdMark);
    let newBody = removeLastTwoLines(note.body);
    await joplin.data.put(['notes', note.id], null, { body: newBody, source_url: '' });
    await joplin.commands.execute('editor.setText', newBody);
    await joplin.commands.execute('focusElement', 'noteBody');
}

// 删除最后两行返回删除之后的文本(删除 -----  HackMD Note ID: adtcqgVWzsghjdfkRwsdfyhHrp)
function removeLastTwoLines(text) {
    const lines = text.split('\n');

    if (lines.length >= 2) {
        lines.pop();
        lines.pop();
    }

    return lines.join('\n');
}

// 查找 markdown 中的标记值（例如'HackMD Note ID: xxxx'）
function getHackmdNoteInfo(body, hmdIdMarkPrefix) {
    const regex = new RegExp(`${hmdIdMarkPrefix}:\\s*(.*)`);
    const match = body.match(regex);
    return match ? match[1] : null;
}