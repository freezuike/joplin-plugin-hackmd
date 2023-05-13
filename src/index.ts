import joplin from 'api';
import { ToolbarButtonLocation } from 'api/types';
import Settings from "./settings";

import HmdAPI from '@hackmd/api'

const shareButton = "share"
let hmdApiClient: HmdAPI;

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

                hmdApiClient = new HmdAPI(token, url);

                let teams = await getTeams(hmdApiClient);
                hackmdUserDialogs(teams).then(async choose => {
                    console.log(choose)
                    switch (choose.id) {
                        case 'cancel':
                            console.debug("取消选择分享")
                            break;
                        default:
                            console.log("选择的用户id: " + choose.id)
                            hackmdDialogs(choose.id).then(async id => {
                                //笔记操作
                                await hackmdTeamNote(hmdApiClient, note, id, choose);
                            });
                            break;
                    }
                })
            },
        });

        joplin.views.toolbarButtons.create(shareButton, shareButton, ToolbarButtonLocation.EditorToolbar);
    },

});

// 分组选择框(个人或者团体)
async function hackmdUserDialogs(teams: { [x: string]: any; }) {
    const hackmdDialogs = joplin.views.dialogs;

    // 暂时想不到如何重新显示Dialog的方法，使用随机数代替，可能点击后会造成无法出现对话框
    const randomInt = Math.floor(Math.random() * (10000 - 1 + 1)) + 1;
    let handle = await hackmdDialogs.create('hackmdUserDialog' + randomInt);
    console.log("handle", handle);
    await hackmdDialogs.setHtml(handle, '<div><p>Choose user and teams</div>');

    let buttons = [{ id: 'user', title: 'user' }];
    for (let key in teams) {
        buttons.push({
            id: teams[key],
            title: key
        });
    }
    buttons.push({ id: 'cancel', title: '' });

    await hackmdDialogs.setButtons(handle, buttons);

    await hackmdDialogs.setButtons(handle, buttons);
    console.log(buttons);
    const id = (await hackmdDialogs.open(handle)).id;
    let result = { id: '', title: '' };
    result.id = id;
    result.title = buttons.find(btn => btn.id === id).title;
    console.log(result)
    return result;
}

//创建说明和按钮
async function hackmdDialogs(name) {
    const hackmdDialogs = joplin.views.dialogs

    // 暂时想不到如何重新显示Dialog的方法，使用随机数代替，可能点击后会造成无法出现对话框
    const randomInt = Math.floor(Math.random() * (10000 - 1 + 1)) + 1;
    let handle = await hackmdDialogs.create(name + randomInt);
    console.log("handle", handle);
    await hackmdDialogs.setHtml(handle, '<div><p>Click on the top right-hand corner Joplin ⚠ (round), check the URL<br>or remove that part to share on HackMD again. </p></div>');
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

// 团队路径
async function getTeams(hmdApiClient: any) {
    try {
        let teams = await hmdApiClient.getTeams();
        let name_path = generateHmdTeams(teams);
        return name_path;
    } catch (error) {
        joplin.views.dialogs.showMessageBox(error);
        return;
    }
}

// 获取团队名称和路径
function generateHmdTeams(teams: any[]) {
    const noteTitles = {};
    teams.forEach((team: { name: any; path: any; }) => {
        const { name, path } = team;
        noteTitles[name] = path;
    });
    return noteTitles;
}

// 团队异常
async function hackmdTeamNote(hmdApiClient: any, note: { source_url: string; body: string | string[]; }, id: any, teamPath: any) {
    console.debug("要进行的操作: " + id);

    try {
        let source_url = note.source_url;
        if (source_url !== null && source_url.trim() !== '') {
            // 如果 note.source_url 不为空且不只包含空格，执行相应的操作
            let teamPathValue = getParamValue(source_url, "teamPath");
            if (teamPathValue !== teamPath.id) {
                throw new Error("This is [" + getParamValue(source_url, "teamName") + "] notes:");
            }

            switch (teamPathValue) {
                case 'user':
                    switch (id) {
                        case 'update':
                            // 执行更新操作
                            await updateHackmdNote(hmdApiClient, note);
                            break;
                        case 'delete':
                            // 执行删除操作
                            await deleteHackmdNote(hmdApiClient, note);
                            break;
                        default:
                            // 取消操作
                            break;
                    }
                    break;
                case teamPathValue:
                    switch (id) {
                        case 'update':
                            // 执行更新操作
                            await updateHackmdTeamNote(hmdApiClient, teamPath, note);
                            break;
                        case 'delete':
                            // 执行删除操作
                            await deleteHackmdTeamNote(hmdApiClient, teamPath, note);
                            break;
                        default:
                            // 取消操作
                            break;
                    }
                    break;
                default:
                    // 取消操作
                    break;
            }
        } else {
            if (teamPath.id === "user") {
                await createHackmdNote(hmdApiClient, teamPath, note);
            } else {
                await createHackmdTeamNote(hmdApiClient, teamPath, note);
            }
        }
    } catch (error) {
        joplin.views.dialogs.showMessageBox(error);
        return;
    }
}

//创建团队笔记
async function createHackmdTeamNote(hmdApiClient: any, teamPath: any, note: any) {
    console.debug("[HackMD] Creating Team note...");
    // Set note name (Title)
    let remoteBody: string = note.body;
    if (!remoteBody.trim().startsWith("# ")) {
        remoteBody = `# ${note.title}\n${remoteBody}`;
    }

    // Set tags (if any)
    const tags: Object = await joplin.data.get(['notes', note.id, 'tags']);
    if (tags && tags['items'] && tags['items'].length > 0) {
        let tagsText = "###### tags:";
        tags['items'].forEach((tag: { title: any; }) => {
            tagsText += ` \`${tag.title}\``;
        });
        remoteBody = remoteBody.replace(/^(#.*\n)/gm, `$1\n${tagsText}\n\n`);
    }

    const { id, publishLink } = await hmdApiClient.createTeamNote(teamPath.id, {
        title: note.title,
        content: remoteBody,
    });

    console.log("[HackMD] New note url:", `${publishLink}?noteId=${id}&teamPath=${teamPath.id}&teamName=${teamPath.title}`);
    await joplin.data.put(['notes', note.id], null, { source_url: `${publishLink}?noteId=${id}&teamPath=${teamPath.id}&teamName=${teamPath.title}` });
}

// 更新团队笔记
//存在一点问题，如果在同时修改了tag和文本的情况下，会导致，只修改了tag，文本为未修改前，需要再次更新
async function updateHackmdTeamNote(hmdApiClient: any, teamPath: any, note: any) {
    console.debug("[HackMD] Update Team note...");

    // Set note name (Title)
    let remoteBody: string = note.body;
    if (!remoteBody.trim().startsWith("# ")) {
        remoteBody = `# ${note.title}\n${remoteBody}`;
    }

    //hackmd笔记id
    const hmdIdMark = getParamValue(note.source_url, "noteId")
    // Set tags (if any)
    const tags: Object = await joplin.data.get(['notes', note.id, 'tags']);
    if (tags && tags['items'] && tags['items'].length > 0) {
        let tagsText = "###### tags:";
        tags['items'].forEach((tag: { title: any; }) => {
            tagsText += ` \`${tag.title}\``;
        });
        remoteBody = remoteBody.replace(/^(#.*\n)/gm, `$1\n${tagsText}\n\n`);
    }

    await hmdApiClient.updateTeamNoteContent(teamPath.id, hmdIdMark, remoteBody);
}

// 删除团队笔记
async function deleteHackmdTeamNote(hmdApiClient: any, teamPath: any, note: any) {
    console.debug("[HackMD] delete team note...");

    //hackmd笔记id

    const hmdIdMark = getParamValue(note.source_url, "noteId");
    await hmdApiClient.deleteTeamNote(teamPath.id, hmdIdMark);
    await joplin.data.put(['notes', note.id], null, { source_url: '' });
}

// 创建笔记
async function createHackmdNote(hmdApiClient: any, teamPath: any, note: any) {
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
        tags['items'].forEach((tag: { title: any; }) => {
            tagsText += ` \`${tag.title}\``;
        });
        remoteBody = remoteBody.replace(/^(#.*\n)/gm, `$1\n${tagsText}\n\n`);
    }

    const { id, publishLink } = await hmdApiClient.createNote({
        title: note.title,
        content: remoteBody,
    });

    console.log("[HackMD] New note url:", `${publishLink}?noteId=${id}&teamPath=${teamPath.id}&teamName=${teamPath.title}`);
    await joplin.data.put(['notes', note.id], null, { source_url: `${publishLink}?noteId=${id}&teamPath=${teamPath.id}&teamName=${teamPath.title}` });
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
    const hmdIdMark = getParamValue(note.source_url, "noteId")
    // Set tags (if any)
    const tags: Object = await joplin.data.get(['notes', note.id, 'tags']);
    if (tags && tags['items'] && tags['items'].length > 0) {
        let tagsText = "###### tags:";
        tags['items'].forEach((tag: { title: any; }) => {
            tagsText += ` \`${tag.title}\``;
        });
        remoteBody = remoteBody.replace(/^(#.*\n)/gm, `$1\n${tagsText}\n\n`);
    }

    await hmdApiClient.updateNoteContent(hmdIdMark, remoteBody);
}

// 删除笔记
async function deleteHackmdNote(hmdApiClient: any, note: any) {
    console.debug("[HackMD] delete note...");

    //hackmd笔记id
    await hmdApiClient.deleteNote(getParamValue(note.source_url, "noteId"));
    await joplin.data.put(['notes', note.id], null, { source_url: '' });
}

// 获取url中参数的值
function getParamValue(url, param) {
    // 获取source_url中的所有参数
    const urlSearchParams = new URLSearchParams(new URL(url).search);
    return urlSearchParams.get(param);
}

// 获取MarkDown中的图片地址
function getMarkdownImageUrls(markdown) {
    const regexp = /!\[(.*?)\]\((.*?)\)/g;
    const urls = [];
    let match;
    while ((match = regexp.exec(markdown)) !== null) {
        urls.push(match[2]);
    }
    return urls;
}

// 转换图片路径
async function convertImageUrls(remoteBody) {
    // 获取 Markdown 文本中的所有图片资源 ID
    const resourceIds = getMarkdownImageUrls(remoteBody).filter(url => url.startsWith(":/")).map(url => url.replace(/:\//, ''));

    // 遍历所有图片资源 ID
    for (let resourceId of resourceIds) {
        // 图片资源在笔记中的路径
        // await joplin.data.resourcePath(resourceId);
        // hackmd暂时未提供这个
        // remoteBody = remoteBody.replace(`![](:/${resourceId})`, `![](${替换后的地址})`);
    }
    // 返回替换后的 Markdown 文本
    return remoteBody;
}