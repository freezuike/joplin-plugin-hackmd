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

                //笔记操作
                hackmdDialogs().then(async id => {
                    // 笔记
                    await hackmdNote(hmdApiClient, note, id);
                    console.debug(id);
                }).catch(error => {
                    // 处理发生错误的情况（即Promise对象的rejected状态）
                    console.error("error", error);
                });
            },
        });

        joplin.views.toolbarButtons.create(shareButton, shareButton, ToolbarButtonLocation.EditorToolbar);
    },

});

//创建说明和按钮
async function hackmdDialogs() {
    const hackmdDialogs = joplin.views.dialogs

    // 暂时想不到如何重新显示Dialog的方法，使用随机数代替，可能点击后会造成无法出现对话框
    const randomInt = Math.floor(Math.random() * (10000 - 1 + 1)) + 1;
    let handle = await hackmdDialogs.create('hackmdDialog' + randomInt);
    console.log("handle", handle);
    await hackmdDialogs.setHtml(handle, '<div><p>Note already shared on HackMD, check footer part of your note for HackMD link,<br>or remove that part to share on HackMD again. </p></div>');
    await hackmdDialogs.setButtons(handle, [
        {
            id: 'create',
            title: 'create'
        },
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
    let id = (await hackmdDialogs.open(handle)).id
    return id;
}

// 异常
async function hackmdNote(hmdApiClient, note, id) {
    try {
        switch (id) {
            case 'update':
                // 执行更新操作
                if (note.body.includes(hmdIdMarkPrefix)) {
                    await updateHackmdNote(hmdApiClient, note);
                }
                break;
            case 'delete':
                // 执行删除操作
                if (note.body.includes(hmdIdMarkPrefix)) {
                    await deleteHackmdNote(hmdApiClient, note);
                }
                break;
            case 'cancel':
                // 取消操作
                break;
            default:
                if (!note.body.includes(hmdIdMarkPrefix)) {
                    await createHackmdNote(hmdApiClient, note);
                }
                break;
        }
    } catch (error) {
        console.error("error", error);
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
//存在一点问题，如果在同时修改了tag和文本的情况下，会导致，只修改了tag，文本为未修改前，需要再次更新
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