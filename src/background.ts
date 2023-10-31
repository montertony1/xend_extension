import { resolveCname } from "dns";

chrome.runtime.onConnect.addListener(function(port) {
    console.assert(port.name === "authorize");
    port.onMessage.addListener(async function(msg) {
        if (msg.task === "startTwitterAuth") {
            try {
                const response = await (await fetch(`http://localhost:3001/backend/user/request_access_token`)).json();
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
                        const result = await fetch(`http://localhost:3001/backend/user/access_token`, {
                            method: 'POST',
                            body: JSON.stringify(data),
                            headers: { 'Content-Type': 'application/json','Accept':'application/json'}
                        });
                        let access_token = await result.json();
                        console.log("Access_Token", access_token);
                        if (access_token.token) {
                            try {
                                const params = { token: access_token.token, secret: access_token.secret };
                                const res = await (await fetch(`http://localhost:3001/backend/user/get_user_profile`, {
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
                const params = { address: msg.address, uid: msg.uid };
                const res = await (await fetch(`http://localhost:3001/backend/user/set_address`, {
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
            const result = await (await fetch(`http://localhost:3001/backend/user/post_article`, {
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
            const result = await (await fetch(`http://localhost:3001/backend/user/post_comment`, {
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
                const result = await (await fetch(`http://localhost:3001/backend/user/get_article_count?uid=${msg.uid}&token=${msg.token}&secret=${msg.secret}`)).json();
                let articles = [];
                if (result.count > 0) {
                    let res = await (await fetch(`http://localhost:3001/backend/user/get_articles_by_uid?uid=${msg.uid}&token=${msg.token}&secret=${msg.secret}&start=${0}&num=${msg.range}`)).json();
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
                let res = await (await fetch(`http://localhost:3001/backend/user/get_articles_by_uid?uid=${msg.uid}&token=${msg.token}&secret=${msg.secret}&start=${msg.start}&num=${msg.range}`)).json();
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
                const result = await (await fetch(`http://localhost:3001/backend/user/delete_article`, {
                    method: 'POST',
                    body: JSON.stringify(data),
                    headers: { 'Content-Type': 'application/json','Accept':'application/json'}
                })).json();

                if (result.status) {
                    port.postMessage({
                        result: "successDeleteArticle", 
                        start: result.start,
                        articles: result.articles
                    });
                }
                console.log(result);
            } catch (error) {
                
            }
        } else if (msg.task === "getMyKeys") {
            let data;
            try {
                console.log("getMyKeys", msg);
                data = await (await fetch(`http://localhost:3001/backend/user/get_my_keys?uid=${msg.uid}&token=${msg.token}&secret=${msg.secret}`)).json();
                console.log("getMyKeys", data);
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
                res = await (await fetch(`http://localhost:3001/backend/user/get_key_detail?uid=${msg.uid}&token=${msg.token}&secret=${msg.secret}&keyOwnerName=${msg.keyOwnerName}`)).json();
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
        }
    });
  });