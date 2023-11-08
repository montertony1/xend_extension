import { resolveCname } from "dns";

// @ts-ignore
chrome.runtime.onConnect.addListener(function(port) {
    console.assert(port.name === "authorize");
    port.onMessage.addListener(async function(msg: any) {
        if (msg.task === "startTwitterAuth") {
            try {
                const response = await (await fetch(`http://82.180.136.36:3001/backend/user/request_access_token`)).json();
                const authUrl = new URL('https://api.twitter.com/oauth/authenticate');
                authUrl.searchParams.set('oauth_token', response.token);
                authUrl.searchParams.set('force_login', 'false');
                
                console.log("Request_Access_Token", response, authUrl.href);

                // @ts-ignore
                chrome.identity.launchWebAuthFlow({ url: authUrl.href, interactive: true }, async (responseUrl: any) => {
                    console.log("ResponseURL", responseUrl);
                    const oauth_token = responseUrl.split('?')[1].split('&')[0].split('=')[1];
                    const oauth_verifier = responseUrl.split('?')[1].split('&')[1].split('=')[1];
                    
                    console.log("OAuth-Token, OAuth-Verifier", oauth_token, oauth_verifier);
                    
                    const data = { token: oauth_token, verifier: oauth_verifier, secret: response.secret };
                    try {
                        const result = await fetch(`http://82.180.136.36:3001/backend/user/access_token`, {
                            method: 'POST',
                            body: JSON.stringify(data),
                            headers: { 'Content-Type': 'application/json','Accept':'application/json'}
                        });
                        let access_token = await result.json();
                        console.log("Access_Token", access_token);
                        if (access_token.token) {
                            try {
                                const params = { token: access_token.token, secret: access_token.secret };
                                const res = await (await fetch(`http://82.180.136.36:3001/backend/user/get_user_profile`, {
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
        }
    });
  });