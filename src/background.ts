import { resolveCname } from "dns";
import { TrustedHTML } from "trusted-types/lib";
import Web3 from 'web3';

chrome.runtime.onConnect.addListener(function(port) {
    console.assert(port.name === "authorize");
    port.onMessage.addListener(async function(msg) {
        if (msg.task === "startTwitterAuth") {
            try {
                const response = await (await fetch(`https://api.xend.tech/backend/user/request_access_token`)).json();
                const authUrl = new URL('https://api.twitter.com/oauth/authenticate');
                authUrl.searchParams.set('oauth_token', response.token);
                authUrl.searchParams.set('force_login', 'false');
                
                console.log("Request_Access_Token", response, authUrl.href);
                chrome.identity.launchWebAuthFlow({ url: authUrl.href, interactive: true }, async (responseUrl: any) => {
                    console.log("ResponseURL", responseUrl);
                    const oauth_token = responseUrl.split('?')[1].split('&')[0].split('=')[1];
                    const oauth_verifier = responseUrl.split('?')[1].split('&')[1].split('=')[1];
                    
                    console.log("OAuth-Token, OAuth-Verifier", oauth_token, oauth_verifier);
                    
                    const data = { token: oauth_token, verifier: oauth_verifier, secret: response.secret };
                    try {
                        const result = await fetch(`https://api.xend.tech/backend/user/access_token`, {
                            method: 'POST',
                            body: JSON.stringify(data),
                            headers: { 'Content-Type': 'application/json','Accept':'application/json'}
                        });
                        let access_token = await result.json();
                        console.log("Access_Token", access_token);
                        if (access_token.token) {
                            try {
                                const params = { token: access_token.token, secret: access_token.secret };
                                const res = await (await fetch(`https://api.xend.tech/backend/user/get_user_profile`, {
                                    method: 'POST',
                                    body: JSON.stringify(params),
                                    headers: { 'Content-Type': 'application/json','Accept':'application/json'}
                                })).json();
    
                                console.log("profile: ", res);
                                if (res.uid) {
                                    port.postMessage({
                                        result: "successTwitterAuth", 
                                        token: access_token.token, 
                                        secret: access_token.secret,
                                        handle: res.handle,
                                        address: res.address,
                                        pfp: res.pfp,
                                        uid: res.uid
                                    });
                                } else {
                                    console.log("error");
                                }
                            } catch(error) {
                                console.log("error");
                            }
                        } else {
                            console.log("error");
                        }
                    } catch(error) {
                        console.log("error");
                    }
                });
            } catch(error) {
                console.log("error");
            }
        } else if (msg.task === "setWalletAddr") {
            try {
                const params = { 
                    address: msg.address, 
                    uid: msg.uid,
                    signature: msg.signature,
                    message: msg.message,
                    token: msg.token,
                    secret: msg.secret 
                };
                const res = await (await fetch(`https://api.xend.tech/backend/user/set_address`, {
                    method: 'POST',
                    body: JSON.stringify(params),
                    headers: { 'Content-Type': 'application/json','Accept':'application/json'}
                })).json();
    
                console.log("Set Address: ", res);
    
                if (res.result != undefined) {
                    port.postMessage({
                        result: "statusWalletSet", 
                        status: true
                    });
                } else {
                    console.log("error1");
                    port.postMessage({
                        result: "statusWalletSet", 
                        status: false
                    });
                }
            } catch(error) {
                console.log("error2");
            }
        } else if (msg.task === "postArticle") {
            console.log("postArticle", msg);
            const data = {
                image: msg.image,
                content: msg.content,
                uid: msg.uid,
                token: msg.token,
                secret: msg.secret,
                type: msg.type,
                range: msg.range
            };
            const result = await (await fetch(`https://api.xend.tech/backend/user/post_article`, {
                method: 'POST',
                body: JSON.stringify(data),
                headers: { 'Content-Type': 'application/json','Accept':'application/json'}
            })).json();

            if (result.articles.length > 0) {
                port.postMessage({
                    result: "successPostArticle", 
                    articles: result.articles,
                    count: result.count,
                    start: result.start
                });    
            }
        } else if (msg.task === "postComment") {
            console.log("postComment", msg);
            const data = {
                postID: msg.postID,
                content: msg.content,
                token: msg.token,
                secret: msg.secret,
                uid: msg.uid,
                articlePosterUID: msg.articlePosterUID,
                start: msg.start,
                num: msg.num
            };
            const result = await (await fetch(`https://api.xend.tech/backend/user/post_comment`, {
                method: 'POST',
                body: JSON.stringify(data),
                headers: { 'Content-Type': 'application/json','Accept':'application/json'}
            })).json();

            if (result.articles.length > 0) {
                port.postMessage({
                    result: "successPostComment", 
                    articles: result.articles
                });    
            }
        } else if (msg.task === "openProfilePage") {
            try {
                const result = await (await fetch(`https://api.xend.tech/backend/user/get_article_count?uid=${msg.uid}&token=${msg.token}&secret=${msg.secret}`)).json();
                let articles = [];
                if (result.count > 0) {
                    let res = await (await fetch(`https://api.xend.tech/backend/user/get_articles_by_uid?uid=${msg.uid}&token=${msg.token}&secret=${msg.secret}&start=${0}&num=${msg.range}`)).json();
                    console.log(res);
                    articles = res.data;
                }

                port.postMessage({
                    result: "setArticleCount", 
                    count: result.count,
                    articles
                });
            } catch (error) {
                port.postMessage({
                    result: "setArticleCount", 
                    count: 0,
                    articles: []
                });
            }
        } else if (msg.task === "getNextArticlesPage") {
            let articles = [];
            try {
                let res = await (await fetch(`https://api.xend.tech/backend/user/get_articles_by_uid?uid=${msg.uid}&token=${msg.token}&secret=${msg.secret}&start=${msg.start}&num=${msg.range}`)).json();
                console.log(res);
                articles = res.data;
            } catch (error) {
                articles = [];
            }
            port.postMessage({
                result: "setNextArticlesPage",
                articles
            });
        } else if (msg.task === "deleteArticle") {
            try {
                console.log("deleteArticle", msg);
                const data = {
                    postID: msg.postID,
                    uid: msg.uid,
                    token: msg.token,
                    secret: msg.secret,
                    articlePosterUID: msg.articlePosterUID,
                    start: msg.start,
                    num: msg.num
                };
                const result = await (await fetch(`https://api.xend.tech/backend/user/delete_article`, {
                    method: 'POST',
                    body: JSON.stringify(data),
                    headers: { 'Content-Type': 'application/json','Accept':'application/json'}
                })).json();

                if (result.status) {
                    port.postMessage({
                        result: "successDeleteArticle", 
                        start: result.start,
                        articles: result.articles,
                        count: result.count
                    });
                }
                console.log(result);
            } catch (error) {
                console.log("successDeleteArticle", error);
            }
        } else if (msg.task === "getMyKeys") {
            let data;
            let friendTechKeyInfo = [];
            let newKeyData: any = [];
            try {
                console.log("getMyKeys", msg);
                data = await (await fetch(`https://api.xend.tech/backend/user/get_my_keys?uid=${msg.uid}&token=${msg.token}&secret=${msg.secret}`)).json();
                let result = await (await fetch(`https://prod-api.kosetto.com/users/${msg.address.toLowerCase()}/token-holdings`)).json();
                let friendTechKeys = result.users;
                for (let i = 0; i < friendTechKeys.length; i++) {
                    let keyInfo = await (await fetch (`https://prod-api.kosetto.com/twitter-users/${friendTechKeys[i].twitterUsername}`)).json();
                    let friendTechItem = {
                        uid: friendTechKeys[i].twitterUserId,
                        name: friendTechKeys[i].twitterUsername,
                        address: friendTechKeys[i].address,
                        avatar: friendTechKeys[i].twitterPfpUrl,
                        price: Web3.utils.fromWei(keyInfo.displayPrice, "ether"),
                        balance: keyInfo.balance
                    };
                    data.totalPrice += Number(friendTechItem.price) * Number(friendTechItem.balance);
                    friendTechKeyInfo.push({
                        ...friendTechItem
                    });

                    let isDuplicated = false;
                    for (let j = 0; j < data.myKeys.length; j++) {
                        if (data.myKeys[j].name == friendTechKeys[i].twitterUsername) {
                            isDuplicated = true;
                            newKeyData.push({
                                xend: data.myKeys[j],
                                friendtech: friendTechItem
                            });
                            break;
                        }
                    }
                    if (isDuplicated == false) {
                        newKeyData.push({
                            friendtech: friendTechItem
                        });
                    }
                }
                for (let i = 0; i < data.myKeys.length; i++) {
                    let isDuplicated = false;
                    for (let j = 0; j < friendTechKeyInfo.length; j++) {
                        if (data.myKeys[i].name == friendTechKeyInfo[j].name) {
                            isDuplicated = true;
                            break;
                        }
                    }
                    if (!isDuplicated) {
                        newKeyData.push({
                            xend: data.myKeys[i]
                        });
                    }
                }
                newKeyData = newKeyData.reverse();
                console.log("getMyKeys", data, friendTechKeys, friendTechKeyInfo, newKeyData);
                data.myKeys = newKeyData;
            } catch (error) {
                console.log("getMyKeys", error);
                data = {
                    holderNum: "0", keyBalance: "0", priceInETH: "0", totalPrice: "0", myKeys: []
                };
            }
            port.postMessage({
                result: "successGetMyKeys", 
                ...data
            });
        } else if (msg.task === "getKeyInfo") {
            let res;
            try {
                console.log("getKeyInfo", msg);
                res = await (await fetch(`https://api.xend.tech/backend/user/get_key_detail?uid=${msg.uid}&token=${msg.token}&secret=${msg.secret}&keyOwnerName=${msg.keyOwnerName}`)).json();
                console.log("getKeyInfo", res);
            } catch (error) {
                console.log("getKeyInfo", error);
                res = {
                    result: "error",
                    data: {}
                };
            }
            port.postMessage({
                result: "successGetKeyInfo", 
                data: res
            });
        } else if (msg.task === "setFriendTechCompatibility") {
            try {
                console.log("deleteArticle", msg);
                const data = {
                    isCompatible: msg.isCompatible,
                    uid: msg.uid,
                    token: msg.token,
                    secret: msg.secret
                };
                const result = await (await fetch(`https://api.xend.tech/backend/user/set_compatibility`, {
                    method: 'POST',
                    body: JSON.stringify(data),
                    headers: { 'Content-Type': 'application/json','Accept':'application/json'}
                })).json();

                if (result.result == "success") {
                    port.postMessage({
                        result: "successSetCompatibility", 
                        status: true
                    });
                } else {
                    port.postMessage({
                        result: "successSetCompatibility", 
                        status: false
                    });
                }
                console.log(result);
            } catch (error) {
                console.log("setCompatibility", error);
            }
        } else if (msg.task === "getCompatibility") {
            try {
                console.log("getCompatibility", msg);
                let res = await (await fetch(`https://api.xend.tech/backend/user/get_compatibility?uid=${msg.uid}&token=${msg.token}&secret=${msg.secret}`)).json();
                let value = false;
                if (res.result == "success") {
                    value = res.value;
                }
                console.log("getCompatibility: ", res);
                port.postMessage({
                    result: "successGetCompatibility", 
                    isCompatibility: value
                });
            } catch (error) {
                console.log("getCompatibility", error);
                port.postMessage({
                    result: "successGetCompatibility", 
                    isCompatibility: false
                });
            }
        } else if (msg.task === "getFeeds") {
            try {
                console.log("getFeeds", msg);
                let res = await (await fetch(`https://api.xend.tech/backend/user/get_feeds?uid=${msg.uid}&token=${msg.token}&secret=${msg.secret}&start=${msg.start}&num=${msg.num}`)).json();
                port.postMessage({
                    result: "successGetFeeds", 
                    count: res.count,
                    results: res.result
                });
            } catch (error) {

            }
        } else if (msg.task === "postFeedComment") {
            console.log("postFeedComment", msg);
            const data = {
                postID: msg.postID,
                content: msg.content,
                token: msg.token,
                secret: msg.secret,
                uid: msg.uid,
                articlePosterUID: msg.articlePosterUID,
                start: msg.start,
                num: msg.num
            };
            const result = await (await fetch(`https://api.xend.tech/backend/user/post_comment_feed`, {
                method: 'POST',
                body: JSON.stringify(data),
                headers: { 'Content-Type': 'application/json','Accept':'application/json'}
            })).json();

            if (result.articles.length > 0) {
                port.postMessage({
                    result: "successPostFeedComment", 
                    articles: result.articles
                });    
            }
        } else if (msg.task === "getFriendTechInfo") {
            try {
                console.log("getFeeds", msg);
                let res = await (await fetch(`https://prod-api.kosetto.com/twitter-users/${msg.name}`)).json();
                if (msg.address != null) {
                    let holders = await (await fetch(`https://prod-api.kosetto.com/users/${msg.address.toLowerCase()}/token/holders`)).json();
                    let balance = 0;
                    for (let i = 0; i < holders.users.length; i++) {
                        if (msg.name == holders.users[i].twitterUsername) {
                            balance = holders.users[i].balance;
                        }
                    }
                    port.postMessage({
                        result: "successGetFriendTechInfo", 
                        ...res,
                        balance
                    });
                } else {
                    port.postMessage({
                        result: "successGetFriendTechInfo", 
                        ...res,
                        balance: 0
                    });
                }
            } catch (error) {
                console.log("getFriendTechInfo", error);
            }
        } else if (msg.task === "getMyFriendTechInfo") {
            try {
                console.log("getMyFriendTechInfo", msg);
                let res = await (await fetch(`https://prod-api.kosetto.com/twitter-users/${msg.name}`)).json();
                port.postMessage({
                    result: "successGetMyFriendTechInfo", 
                    address: res.address
                });
            } catch (error) {
                console.log("getMyFriendTechInfo", error);
            }
        } else if (msg.task === "getAddrByname") {
            try {
                console.log("getAddrByname", msg);
                let res = await (await fetch(`https://api.xend.tech/backend/user/get_address_by_name?name=${msg.name}&token=${msg.token}&secret=${msg.secret}`)).json();
                port.postMessage({
                    result: "successGetAddrByname", 
                    ...res
                });
            } catch (error) {
                console.log("getAddrByname", error);
            }
        }
    });
  });