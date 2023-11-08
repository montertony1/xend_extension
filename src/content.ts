import { AnyNaptrRecord } from 'dns';
import Web3 from 'web3';
import { ethers } from "ethers";
import { MetaMaskInpageProvider } from '@metamask/inpage-provider';
import PortDuplexStream from 'extension-port-stream';
import { 
    abi, 
    address, 
    subscribeAddress, 
    subscribeABI, 
    chain, 
    friendTechABI, 
    friendTechAddress, 
    friendTechChain 
} from "./config";
// @ts-ignore
import axios from "axios";

// @ts-ignore
import { detect } from 'detect-browser';

const browser = detect();

// @ts-ignore
const logoW = chrome.runtime.getURL("/static/img/xend-small-white.png");
// @ts-ignore
const logoB = chrome.runtime.getURL("/static/img/xend-small-black.png");
// @ts-ignore
const avatarImg = chrome.runtime.getURL("/static/img/avatar.png");
// @ts-ignore
const avatarImg2 = chrome.runtime.getURL("/static/img/avatar2.png");
// @ts-ignore
const styleList = chrome.runtime.getURL("/static/css/style.css");

let isPendingSubscribe = false;
let isPendingBuy = false;
let isPendingSell = false;
let isPendingUpdatePrice = false;

let state = {
    signedUp: false,
    authorized: false,
    walletConnected: false,
    token: null,
    secret: null,
    file: null,
    loadingArticles: false,
    loadingFeeds: false,
    loadingKeys: false,
    user: {
        address: "",
        uid: "",
        avatar: avatarImg,
        name: "",
        articleCount: 0,
        currentRange: 0,
        isSubscriptionEnabled: false,
        subscribePriceInETH: "0",
        isCompatibility: false,
        pageSize: 2,
        articles: [],
        feedCount: 0,
        currentFeedIDX: 0,
        feedPageSize: 4,
    },
    feed: [],
    keysPageInfo: {
        currentRange: 0,
        pageSize: 5
    },
    key: {
        avatar: avatarImg,
        keyBalance: 0,
        holderNum: 0,
        priceInETH: 0,
        totalPrice: 0
    },
    keys: [],
    profile: {
        holderNum: "0",
        keyBalance: "0",
        priceInETH: "0",
        changeRate: "0%", 
        myKeyBalance: "0",
        subscribeAmt: "1",
        subscribePriceInETH: "0",
        isSubscriptionEnabled: false,
        isSubscribed: false,
        keyId: "",
        keyOwnerName: "",
        keyAvatar: "",
        keyAddress: ""
    }
};

let web3: any = null;
let walletProvider: any = null;
let contract: any = null;
let currentWalletAddress: string = "";
let xendContract: any = null;
let subscribeContract: any = null;
let signer: any = null;

const user = {
    pfp: 'https://pbs.twimg.com/profile_images/1606815745215791105/IX8pacjk_400x400.jpg'
}

const addrTokenWETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const apiUrl = 'https://api.coingecko.com/api/v3';

const config = {
    "CHROME_ID": "nkbihfbeogaeaoehlefnkodbefgpgknn",
    "FIREFOX_ID": "webextension@metamask.io"
}
//////////////////////////////////////////////////////////////////  Utility Functions
async function getTokenPrice(tokenAddr: string) {
    try {
        const response = await axios.get(`${apiUrl}/simple/token_price/ethereum?contract_addresses=${tokenAddr}&vs_currencies=usd&include_market_cap=true`);
        const tokenPrice = response.data[tokenAddr.toLowerCase()].usd;
        return tokenPrice;
    } catch (error: any) {
        console.error('getTokenPrice:', error.message);
        return 0;
    }
}

function validateMetamaskAddress(address: string) {
    try {
      Web3.utils.toChecksumAddress(address);
      if (address.slice(0, 2) != "0x") {
        return false;
      }
      return true;
    } catch (error) {
      return false;
    }
}

// @ts-ignore
async function signMessage(message, signer) {
    try {
        const signature = await signer.signMessage(message);
        return signature;    
    } catch (error) {
        console.log("signMessage: ", error);
        return null;
    }
}

function getNormalizeAddress(accounts: any) {
    return accounts[0] ? accounts[0].toLowerCase() : null
}

function getMetaMaskId () {
    switch (browser && browser.name) {
      case 'chrome':
        return config.CHROME_ID
      case 'firefox':
        return config.FIREFOX_ID
      default:
        return config.CHROME_ID
    }
}

function getInPageProvider() {
  let provider;
  try {
    let currentMetaMaskId = getMetaMaskId();
    // @ts-ignore
    const metamaskPort = chrome.runtime.connect(currentMetaMaskId);
    const pluginStream = new PortDuplexStream(metamaskPort);
    provider = new MetaMaskInpageProvider(pluginStream);
 } catch (e) {
    return null;
  }
  return provider
}

function getProvider() {
    // @ts-ignore
    if (window.ethereum) {
        // @ts-ignore
        return window.ethereum;
    } else {
        const provider = getInPageProvider();
    
        if (provider == null) {
            alert("Please install Metamask");
            logout();
            window.open('https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn', '_blank');
        }
        return provider;
    }
}

function getShortHash(hash: string) {
    if (hash.length < 20) {
        return hash;
    }
    return hash.slice(0, 6) + " ... " + hash.slice(hash.length - 4, hash.length);
}

function getState(callback: any) {
    // @ts-ignore
    chrome.storage.local.get(["state"], (opt) => {
        if (opt && opt.state) {
            state = opt.state;
        }
        callback();
    });
}

function getSeparatorColor() {
    const primaryColumn = document.querySelector('div[data-testid="primaryColumn"]');
    // @ts-ignore
    const compStyles = window.getComputedStyle(primaryColumn);
    return compStyles.borderColor;
}

function getMainColor() {
    const inp = document.querySelector('form[aria-label="Search"] input');
    // @ts-ignore
    const compStyles = window.getComputedStyle(inp);
    return compStyles.color;
}

function getSecondColor() {
    const searchIcon = document.querySelector('form[aria-label="Search"] svg');
    // @ts-ignore
    const compStyles = window.getComputedStyle(searchIcon);
    return compStyles.color;
}

function getLinkColor() {
    const link = document.querySelector('a');
    // @ts-ignore
    const compStyles = window.getComputedStyle(link);
    return compStyles.color;
}

function setThemeColors() {
    // @ts-ignore
    document.querySelector(':root').style.setProperty('--xendhorline', getSeparatorColor());
    // @ts-ignore
    document.querySelector(':root').style.setProperty('--xendsecondcolor', getSecondColor());
    // @ts-ignore
    document.querySelector(':root').style.setProperty('--xendmaincolor', getMainColor());
    // @ts-ignore
    document.querySelector(':root').style.setProperty('--xendlinkcolor', getLinkColor());
}

function injectStyleList() {
    const link = document.createElement("link");
    link.id = "xendExtStyleList";
    link.href = styleList;
    link.type = "text/css";
    link.rel = "stylesheet";
    link.onload = () => {
        console.log('load');
        setThemeColors();
    };
    document.getElementsByTagName("head")[0].appendChild(link);
}

function getPrice(price: any) {
    let nPrice = price * 1;
    return nPrice.toFixed(5);
}

function getTotalPrice(price: any, balance: any) {
    let nPrice = price * 1;
    let nBalance = balance * 1;
    return (nPrice * nBalance).toFixed(5);
}

function showWalletModal(header: any, body: any) {
    // @ts-ignore
    document.querySelector("#walletModalHeaderTxt").innerHTML = header;
    // @ts-ignore
    document.querySelector("#walletModalMainTxt").innerHTML = body;
    // @ts-ignore
    document.querySelector("#walletModal").style.display = "";   
}

function showBuySellModal(header: any, body: any) {
    // @ts-ignore
    document.querySelector("#buySellModalHeaderTxt").innerHTML = header;
    // @ts-ignore
    document.querySelector("#buySellModalMainTxt").innerHTML = body;
    // @ts-ignore
    document.querySelector("#buySellModal").style.display = "";   
}

function showSettingModal(header: any, body: any) {
    // @ts-ignore
    document.querySelector("#settingModalHeaderTxt").innerHTML = header;
    // @ts-ignore
    document.querySelector("#settingModalMainTxt").innerHTML = body;
    // @ts-ignore
    document.querySelector("#settingModal").style.display = "";   
}

// @ts-ignore
async function switchChainToETH(provider) {
    try {
        // @ts-ignore
        const res = await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${chain.toString(16)}` }],
        });
        const prov = new ethers.providers.Web3Provider(getProvider());

        signer = prov.getSigner();
        subscribeContract = new ethers.Contract(subscribeAddress, subscribeABI, prov);
        xendContract = new ethers.Contract(address, abi, prov);
        return true;
    } catch (error) {
        // @ts-ignore
        if (error.code === 4902) {
            try {
                // @ts-ignore
                const res = provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: `0x${chain.toString(16)}`,
                        rpcUrls: ['https://goerli.infura.io/v3/'],
                        chainName: 'Goerli test network',
                        nativeCurrency: {
                            name: 'Goerli ETH',
                            symbol: 'GoerliETH',
                            decimals: 18,
                        },
                        blockExplorerUrls: ['https://goerli.etherscan.io'],
                    }],
                });
                const prov = new ethers.providers.Web3Provider(getProvider());

                signer = prov.getSigner();
                subscribeContract = new ethers.Contract(subscribeAddress, subscribeABI, prov);
                xendContract = new ethers.Contract(address, abi, prov);
                return true;
            } catch (error) {
                console.error("request2: ", error);
            }
        } else {
            console.error("request3: ", error);
        }
    }
    let res: boolean = await switchChainToETH(provider);
    return res;
}

async function getAccounts(provider: AnyNaptrRecord) {
    if (provider) {
        const [accounts, chainId] = await Promise.all([
            // @ts-ignore
            provider.request({
                method: 'eth_requestAccounts',
            }),
            // @ts-ignore
            provider.request({ method: 'eth_chainId' }),
        ]);
        return [accounts, chainId];
    }
    return [];
}
//////////////////////////////////////////////////////////////////  
function logout() {
    // @ts-ignore
    if (state.file != "") {
        // @ts-ignore
        state.file = "";
        // @ts-ignore
        document.getElementById("addFile").value = null;
        // @ts-ignore
        document.getElementById('removeFile').style.backgroundImage = "";
        // @ts-ignore
        document.getElementById('removeFile').style.visibility = "hidden";
    }

    // @ts-ignore
    chrome.storage.local.set({ state: "" });
    
    web3 = null;
    walletProvider = null;
    contract = null;
    currentWalletAddress = "";
    xendContract = null;
    subscribeContract = null;
    signer = null;

    isPendingSubscribe = false;
    isPendingBuy = false;
    isPendingSell = false;

    // @ts-ignore
    document.querySelector('aside[xend="settings"]').parentNode.parentNode.style.display = "none";
    // @ts-ignore
    document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "none";
    // @ts-ignore
    document.querySelector('aside[xend="profile"]').parentNode.parentNode.style.display = "none";
    // @ts-ignore
    document.querySelector('aside[xend="wallet"]').parentNode.parentNode.style.display = "none";
    // @ts-ignore
    document.querySelector('aside[xend="signup"]').parentNode.parentNode.style.display = "none";
    // @ts-ignore
    document.querySelector('aside[xend="login"]').parentNode.parentNode.style.display = "";
}

function createCommentsForm(container: any, postID: any, comments: any) {
    let items: string[] = [];
    console.log("createCommentsForm");
    // @ts-ignore
    comments.forEach((row: any) => {
        items.push(`
        <div class="xend-ext-comments-row"><a href="/${row.author}">@${row.author}</a> ${row.message}</div>
        `);
    });
    return `
      <div class="xend-ext-dashboard-comments">
        ` + (comments.length ? `<a class="xend-ext-view-comments" href="#">View ${comments.length} comments</a>` : '') + `
        <div class="xend-ext-comments-list">
          ` + items.join("") + `
        </div>
        <img class="xend-ext-comments-avatar" src="${avatarImg2}" alt="" draggable="false" />
        <div class="xend-ext-comment"><input type="text" placeholder="Add a comment"/><a href="#" data-pid="${postID}">Post</a></div>
      </div>
    `;
}

function createFeedCommentsForm(postID: any, comments: any, authorUID: any) {
    let items: string[] = [];
    console.log("createFeedCommentsForm");
    // @ts-ignore
    comments.forEach((row: any) => {
        items.push(`
        <div class="xend-ext-comments-row"><a href="/${row.author}">@${row.author}</a> ${row.message}</div>
        `);
    });
    return `
      <div class="xend-ext-dashboard-comments">
        ` + (comments.length ? `<a class="xend-ext-view-comments" href="#">View ${comments.length} comments</a>` : '') + `
        <div class="xend-ext-comments-list">
          ` + items.join("") + `
        </div>
        <img class="xend-ext-comments-avatar" src="${avatarImg2}" alt="" draggable="false" />
        <div class="xend-ext-feedcomment"><input type="text" placeholder="Add a comment"/><a href="#" data-uid="${authorUID}" data-pid="${postID}">Post</a></div>
      </div>
    `;
}

function getFeed(data: any) {
    let items: string[] = [];
    console.log("getFeed");
    if (data.length == 0) {
        return "";
    }
    // @ts-ignore
    data.forEach(row => {
        let tm = Math.ceil((Date.now() - row.timestamp) / 1000) + "s";
        if (parseInt(tm) / 60 >= 1) {
            tm = Math.ceil(parseInt(tm) / 60) + "m";
            if (parseInt(tm) / 60 >= 1) {
                tm = Math.ceil(parseInt(tm) / 60) + "h";
                if (parseInt(tm) / 24 >= 1) {
                    tm = Math.ceil(parseInt(tm) / 24) + "d";
                }
            }
        }
        items.push(`
            <div class="xend-ext-dashboard-row">
            <div class="xend-ext-dashboard-column-left"> 
                <div class="xend-ext-dashboard-news">
                    <img class="xend-ext-dashboard-news-logo" src="${row.avatar}" alt="avatar" draggable="false" />
                    <div class="xend-ext-dashboard-news-user"><a href="/${row.author}">@${row.author}</a></div>
                    <div class="xend-ext-dashboard-news-time">&bullet;&nbsp;${tm} ago</div>
                </div>
                <div class="xend-ext-dashboard-news-title">
                ${row.message}
                </div>
            </div>
            <div class="xend-ext-dashboard-column-right">
                ` + (row.imageUrl ? `<img class="xend-ext-dashboard-avatar" src="${row.imageUrl}" alt="avatar" draggable="false" style="margin-top: 18px;" />` : "") + `
            </div>
            <div style="clear: both"></div>
            ` + createFeedCommentsForm(row.postID, row.comments, row.uid) + `
            </div>
        `);
    });
    return items.join("");
}

function getKeyArray(data: any) {
    let content = "";

    for (let i = 0; i < data.keys.length; i++) {
        content += `<div class="xend-ext-dashboard-row">
                        <div class="xend-ext-dashboard-column-left">         
                            <img class="xend-ext-dashboard-keys-logo" src="${data.keys[i].avatar}" alt="avatar" draggable="false" />
                            <div class="xend-ext-dashboard-keys-user">
                            <a href="/${data.keys[i].name}">@${data.keys[i].name}</a>
                            <div>${getPrice(data.keys[i].price)}</div>
                            </div>
                        </div>
                        <div class="xend-ext-dashboard-column-right">
                            <div class="xend-ext-keys-value">
                                <div>${data.keys[i].balance}</div>
                                <div>
                                    <div class="xend-ext-dashboard-currency"></div>
                                    <span>${getTotalPrice(data.keys[i].price, data.keys[i].balance)}</span>  
                                </div>
                            </div>
                        </div>
                        <div style="clear: both"></div>
                    </div>`;
  }
  return content;
}

function getKeys(container: any, data: any) {
    let content = 
        `<div class="xend-ext-dashboard-keys">
            <img id="xend-ext-dashboard-keys-avatar" class="xend-ext-dashboard-keys-logo" src="${data.avatar}" alt="avatar" draggable="false" />
            <div class="xend-ext-dashboard-keys-col">
                Keys
                <div>${data.keyBalance}</div>
            </div>
            <div class="xend-ext-dashboard-keys-col">
                Holders
                <div>${data.holderNum}</div>
            </div>
            <div class="xend-ext-dashboard-keys-col xend-ext-dashboard-keys-col-price">
                Price
                <div>${getPrice(data.priceInETH)}</div>
            </div>
        </div>

        <div class="xend-ext-dashboard-row xend-ext-dashboard-mykeys">
        <div class="xend-ext-dashboard-column-left"> 
            <div class="xend-ext-keys-header">
                My Keys
            </div>
        </div>
        <div class="xend-ext-dashboard-column-right">
            <div class="xend-ext-dashboard-column-right-currency"></div>
            <span>${getPrice(data.totalPrice)}<span>
        </div>
        <div style="clear: both"></div>
        </div>

        <div id="xend-ext-dashboard-row-container">`;
    
  content += getKeyArray(data);
    
  content += '<div id="xend-ext-keys-loader">&nbsp;</div> </div>';

  return content;
}
//////////////////////////////////////////////////////////////////  APIs
async function setWalletAddr(msg: any) {
    try {
        const params = { 
            address: msg.address, 
            uid: msg.uid,
            signature: msg.signature,
            message: msg.message,
            token: msg.token,
            secret: msg.secret 
        };
        const res = await (await fetch(`http://82.180.136.36:3001/backend/user/set_address`, {
            method: 'POST',
            body: JSON.stringify(params),
            headers: { 'Content-Type': 'application/json','Accept':'application/json'}
        })).json();

        console.log("setWalletAddr: ", res);

        if (res.result != undefined) {
            return {
                result: "statusWalletSet", 
                status: true
            };
        } else {
            return {
                result: "statusWalletSet", 
                status: false
            };
        }
    } catch(error) {
        console.log("setWalletAddr2", error);
    }
    return {
        result: "error"
    }
}

async function postArticle(msg: any) {
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
    const result = await (await fetch(`http://82.180.136.36:3001/backend/user/post_article`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json','Accept':'application/json'}
    })).json();

    return {
        result: "successPostArticle", 
        articles: result.articles,
        count: result.count,
        start: result.start
    };    
}

async function postComment(msg: any) {
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
    const result = await (await fetch(`http://82.180.136.36:3001/backend/user/post_comment`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json','Accept':'application/json'}
    })).json();

    return {
        result: "postComment", 
        articles: result.articles
    };    
}

async function openProfilePage(msg: any) {
    try {
        const result = await (await fetch(`http://82.180.136.36:3001/backend/user/get_article_count?uid=${msg.uid}&token=${msg.token}&secret=${msg.secret}`)).json();
        let articles = [];
        if (result.count > 0) {
            let res = await (await fetch(`http://82.180.136.36:3001/backend/user/get_articles_by_uid?uid=${msg.uid}&token=${msg.token}&secret=${msg.secret}&start=${0}&num=${msg.range}`)).json();
            console.log(res);
            articles = res.data;
        }

        return {
            result: "setArticleCount", 
            count: result.count,
            articles
        };
    } catch (error) {
        console.log("openProfilePage", error);
    }
    return {
        result: "setArticleCount", 
        count: 0,
        articles: []
    };
}

async function getNextArticlesPage(msg: any) {
    let articles = [];
    try {
        let res = await (await fetch(`http://82.180.136.36:3001/backend/user/get_articles_by_uid?uid=${msg.uid}&token=${msg.token}&secret=${msg.secret}&start=${msg.start}&num=${msg.range}`)).json();
        console.log(res);
        articles = res.data;
    } catch (error) {
        articles = [];
    }
    return {
        result: "setNextArticlesPage",
        articles
    };
}

async function deleteArticle(msg: any) {
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
        const result = await (await fetch(`http://82.180.136.36:3001/backend/user/delete_article`, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json','Accept':'application/json'}
        })).json();

        if (result.status) {
            return {
                result: "successDeleteArticle", 
                start: result.start,
                articles: result.articles,
                count: result.count
            };
        }
        console.log(result);
    } catch (error) {
        console.log("deleteArticle", error);
    }
    return {
        result: "error"
    };
}

async function getMyKeys(msg: any) {
    let data;
    try {
        console.log("getMyKeys", msg);
        data = await (await fetch(`http://82.180.136.36:3001/backend/user/get_my_keys?uid=${msg.uid}&token=${msg.token}&secret=${msg.secret}`)).json();
        console.log("getMyKeys", data);
    } catch (error) {
        console.log("getMyKeys", error);
    }
    return {
        result: "successGetMyKeys", 
        holderNum: "0", 
        keyBalance: "0", 
        priceInETH: "0", 
        totalPrice: "0", 
        myKeys: []
    };
}

async function getKeyInfo(msg: any) {
    let res;
    try {
        console.log("getKeyInfo", msg);
        res = await (await fetch(`http://82.180.136.36:3001/backend/user/get_key_detail?uid=${msg.uid}&token=${msg.token}&secret=${msg.secret}&keyOwnerName=${msg.keyOwnerName}`)).json();
        console.log("getKeyInfo", res);
    } catch (error) {
        console.log("getKeyInfo", error);
        res = {
            result: "error",
            data: {}
        };
    }
    return {
        result: "successGetKeyInfo", 
        data: res
    };
}

async function setFriendTechCompatibility(msg: any) {
    try {
        console.log("deleteArticle", msg);
        const data = {
            isCompatible: msg.isCompatible,
            uid: msg.uid,
            token: msg.token,
            secret: msg.secret
        };
        const result = await (await fetch(`http://82.180.136.36:3001/backend/user/set_compatibility`, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json','Accept':'application/json'}
        })).json();

        if (result.result == "success") {
            return {
                result: "successSetCompatibility", 
                status: true
            };
        } else {
            return {
                result: "successSetCompatibility", 
                status: false
            };
        }
    } catch (error) {
        console.log("setCompatibility", error);
    }
    return {
        result: "error"
    }
}

async function getCompatibility(msg: any) {
    try {
        console.log("getCompatibility", msg);
        let res = await (await fetch(`http://82.180.136.36:3001/backend/user/get_compatibility?uid=${msg.uid}&token=${msg.token}&secret=${msg.secret}`)).json();
        let value = false;
        if (res.result == "success") {
            value = res.value;
        }
        console.log("getCompatibility: ", res);
        return {
            result: "successGetCompatibility", 
            isCompatibility: value
        };
    } catch (error) {
        console.log("getCompatibility", error);
    }
    return {
        result: "successGetCompatibility", 
        isCompatibility: false
    };
}

async function getFeeds(msg: any) {
    try {
        console.log("getFeeds", msg);
        let res = await (await fetch(`http://82.180.136.36:3001/backend/user/get_feeds?uid=${msg.uid}&token=${msg.token}&secret=${msg.secret}&start=${msg.start}&num=${msg.num}`)).json();
        return {
            result: "successGetFeeds", 
            count: res.count,
            results: res.result
        };
    } catch (error) {
        console.log(error);

    }        
    return {
        result: "error"
    };
}

async function postFeedComment(msg: any) {
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
    const result = await (await fetch(`http://82.180.136.36:3001/backend/user/post_comment_feed`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json','Accept':'application/json'}
    })).json();

    return {
        result: "successPostFeedComment", 
        articles: result.articles
    };    
}

async function getFriendTechInfo(msg: any) {
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
            return {
                result: "successGetFriendTechInfo", 
                ...res,
                balance
            };
        } else {
            return {
                result: "successGetFriendTechInfo", 
                ...res
            };
        }
    } catch (error) {
        console.log(error);
    }
    return {
        result: "error"
    };
}
//////////////////////////////////////////////////////////////////
function traverseAndFindAttribute(node: any, tagName: string):any {
    let nodes = []
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName.toLowerCase() === tagName && node.getElementsByTagName('a').length > 0
          && node.getAttribute('xend') !== 'send'
          && node.getAttribute('xend') !== 'feed'
          && node.getAttribute('xend') !== 'login'
          && node.getAttribute('xend') !== 'wallet'
          && node.getAttribute('xend') !== 'dashboard'
          && node.getAttribute('xend') !== 'profile'
          && node.getAttribute('xend') !== 'settings'
      ) {
        if (node.parentElement.parentElement.parentElement.children.length > 1) {
            console.log('aside found');
            console.log(node)
            // @ts-ignore
            nodes.push(node)
        }
      }
      const attribute = node.getAttribute('data-testid');

      if (attribute === 'UserProfileSchema-test') {
        console.log("profile schema test");
        const xendSend = document.querySelector('[xend="send"]')
        if (xendSend) {
            const author = JSON.parse(node.innerHTML).author;
            console.log("author", author);
            const uid = author.identifier;
            console.log('mutationobserver', uid);
            xendSend.getElementsByTagName('span')[0].innerText = `@${author.additionalName}`;
            xendSend.parentElement!.parentElement!.style.display = '';
        }
      } else {
        const user = document.querySelector('[data-testid="UserProfileSchema-test"]') 
        const xendSend = document.querySelector('[xend="send"]');
        if (!user && xendSend) { 
            xendSend.parentElement!.parentElement!.style.display = 'none';
        }
      }
    }

    for (const child of node.childNodes) {
      nodes = nodes.concat(traverseAndFindAttribute(child, tagName))
    }
    return nodes;
}

async function login() {
    console.log("login");
  
    // @ts-ignore
    if (state.authorized && document.querySelector('aside[xend="wallet"]') && document.querySelector('aside[xend="wallet"]').parentNode.parentNode.style.display == "none") {
        // @ts-ignore
        document.querySelector('aside[xend="login"]').parentNode.parentNode.style.display = "none";
        // @ts-ignore
        document.querySelector('aside[xend="wallet"]').parentNode.parentNode.style.display = "";
        return;
    }

    // @ts-ignore
    var port = chrome.runtime.connect({name: "authorize"});
    port.postMessage({task: "startTwitterAuth"});
    port.onMessage.addListener(function(msg: any) {
        if (msg.result === "successTwitterAuth") {
            console.log("successTwitterAuth: ", msg.token, msg.secret);
            state.authorized = true;
            state.token = msg.token;
            state.secret = msg.secret;
            state.user.address = msg.address;
            state.user.uid = msg.uid;
            state.user.avatar = msg.pfp;
            state.user.name = msg.handle;

            console.log("setUserInfo", state.user.avatar, state.user.name);
            // @ts-ignore
            document.getElementById("xend-ext-settings-avatar").src = state.user.avatar;
            // @ts-ignore
            document.getElementById("xend-ext-settings-user").innerHTML = state.user.name;
            // @ts-ignore
            document.getElementById("xend-ext-menu-avatar").src = state.user.avatar;
            // @ts-ignore
            document.getElementById("xend-ext-menu-user").innerHTML = state.user.name;
            // @ts-ignore
            document.getElementById("xend-ext-wallet-avatar").src = state.user.avatar;
            // @ts-ignore
            document.getElementById("xend-ext-wallet-user").innerHTML = state.user.name;
            // @ts-ignore
            document.getElementById("xend-ext-signup-avatar").src = state.user.avatar;
            // @ts-ignore
            document.getElementById("xend-ext-signup-user").innerHTML = state.user.name;
            // @ts-ignore
            document.getElementById("xend-ext-dashboard-setting-avatar").src = state.user.avatar;
            // @ts-ignore
            document.getElementById("xend-ext-dashboard-keys-avatar").src = state.user.avatar;

            // @ts-ignore
            chrome.storage.local.set({ state });

            // @ts-ignore
            if (state.authorized && document.querySelector('aside[xend="wallet"]') && document.querySelector('aside[xend="wallet"]').parentNode.parentNode.style.display == "none") {
                // @ts-ignore
                document.querySelector('aside[xend="login"]').parentNode.parentNode.style.display = "none";
                // @ts-ignore
                document.querySelector('aside[xend="wallet"]').parentNode.parentNode.style.display = "";
            }
        }
    });
}

async function connectWalletFunc() {
    let provider = getProvider();
    try {
        //@ts-ignore
        const [accounts, chainId] = await getAccounts(provider);
        
        if (chain != chainId) {
            const result = await switchChainToETH(provider);
            if (!result) {
                showWalletModal("Alert", "Please switch to Goerli Testnet.");
                return;
            }
        }

        if (accounts && chainId) {
            const account = getNormalizeAddress(accounts);
            
            if (state.user.address != null) {
                if (state.user.address.toLowerCase() != account.toLowerCase()) {
                    showWalletModal("Wrong Wallet.", `Connect your paired XEND wallet, ${getShortHash(state.user.address)} to continue.`);
                    return {
                        result: false
                    };
                }
            }
            if (chainId != chain) {
                return {
                    result: false
                }
            }
            web3 = new Web3(provider);

            // @ts-ignore
            contract = new web3.eth.Contract(abi, address);

            return {
                result: true,
                address: account
            };
        } else {
            showWalletModal("Alert", "Please connect wallet.");
        }
    } catch (error) {
        console.log("error while connect", error);
    }
    return {
        result: false
    };
}

async function connectWallet() {
    console.log("connectWallet");

    const res = await connectWalletFunc();
    // @ts-ignore
    if (!res.result) {
        return;
    }
    state.walletConnected = true;

    // @ts-ignore
    chrome.storage.local.set({ state: state });
    // @ts-ignore
    currentWalletAddress = res.address;
    if (state.authorized && state.walletConnected && state.signedUp) {
        if (
            document.querySelector('aside[xend="dashboard"]')
            // @ts-ignore
            && document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display == "none"
        ) {
            // @ts-ignore
            document.querySelector('aside[xend="wallet"]').parentNode.parentNode.style.display = "none";
            console.log("Connect Wallet->Dashboard Without SignUp");
            await checkURL(false);
            // @ts-ignore
            document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "";
        }
    } else {
        const provider = new ethers.providers.Web3Provider(getProvider());

        signer = provider.getSigner();
        subscribeContract = new ethers.Contract(subscribeAddress, subscribeABI, provider);
        xendContract = new ethers.Contract(address, abi, provider);

        try {
            const result = await xendContract.connect(signer)["getCreatorSignUpStatus"](currentWalletAddress);
            if (!result) {
                if (state.authorized && state.walletConnected
                    && document.querySelector('aside[xend="signup"]')
                    // @ts-ignore
                    && document.querySelector('aside[xend="signup"]').parentNode.parentNode.style.display == "none"
                ) {
                    // @ts-ignore
                    document.querySelector('aside[xend="wallet"]').parentNode.parentNode.style.display = "none";
                    // @ts-ignore
                    document.querySelector('aside[xend="signup"]').parentNode.parentNode.style.display = "";
                }
            } else {
                state.signedUp = true;

                // @ts-ignore
                chrome.storage.local.set({ state: state });

                // @ts-ignore
                document.querySelector('aside[xend="wallet"]').parentNode.parentNode.style.display = "none";
                console.log("Connect Wallet->Dashboard");
                await checkURL(false);
                // @ts-ignore
                document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "";
            }
        } catch (error: any) {
            console.log("getCreatorSignUpStatus", error);
            return;
        }
    }
}

// @ts-ignore
async function successSignup(signature, message) {
    let msg = await setWalletAddr({
        task: "setWalletAddr",
        address: currentWalletAddress,
        uid: state.user.uid,
        token: state.token,
        secret: state.secret,
        signature: signature,
        message: message
    });

    if (msg.result === "statusWalletSet") {
        console.log("statusWalletSet: ", msg.result);
        if (msg.status) {
            state.user.address = currentWalletAddress;
            state.signedUp = true;

            // @ts-ignore
            chrome.storage.local.set({ state: state });
        
            if (state.authorized && state.walletConnected && state.signedUp
                && document.querySelector('aside[xend="dashboard"]')
                // @ts-ignore
                && document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display == "none"
            ) {
                // @ts-ignore
                document.querySelector('aside[xend="signup"]').parentNode.parentNode.style.display = "none";
                await checkURL(false);
                // @ts-ignore
                document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "";
                return;
            }                
        }
    }
}

async function signUp() {
    if (state.authorized && state.walletConnected && state.signedUp
        && document.querySelector('aside[xend="dashboard"]')
        // @ts-ignore
        && document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display == "none"
    ) {
        // @ts-ignore
        document.querySelector('aside[xend="signup"]').parentNode.parentNode.style.display = "none";
        // @ts-ignore
        document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "";
        return;
    }   

    // @ts-ignore
    let referrer = document.getElementById("xend-ext-signup-referrer-name").value;
    
    const prov = getProvider();
    const provider = new ethers.providers.Web3Provider(prov);

    signer = provider.getSigner();
    subscribeContract = new ethers.Contract(subscribeAddress, subscribeABI, provider);
    xendContract = new ethers.Contract(address, abi, provider);

    let message = `Hello, This is ${state.user.name}`;
    const signature = await signMessage(message, signer);
    if (signature == null) {
        alert("Please Sign.");
        return;
    }

    if (referrer == "") {
        console.log("referrer1: ", referrer);

        try {
            const result = await xendContract.connect(signer)["signUp"]([]);
            console.log(result);
            if (!result.hash) {
                return;
            }
            // @ts-ignore
            result.wait().then(res => {
                successSignup(signature, message);
            });
        } catch (error: any) {
            console.log("signUpError", error.error);
            if (error.error.message == "execution reverted: User is already signed up") {
                state.signedUp = true;

                // @ts-ignore
                chrome.storage.local.set({ state: state });
            
                // @ts-ignore
                document.querySelector('aside[xend="signup"]').parentNode.parentNode.style.display = "none";
                await checkURL(false);
                // @ts-ignore
                document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "";      
            }
            return;
        }
    } else {
        console.log("referrer2: ", referrer);
        if (!validateMetamaskAddress(referrer)) {
            console.log("referrer3: ", referrer);
            // @ts-ignore
            document.getElementById("xend-ext-signup-referrer-alert").innerHTML = "Invalid Wallet Address!";
            return;
        }
        console.log("referrer4: ", referrer);

        try {
            const result = await xendContract.connect(signer)["signUpWithReferral"](referrer);
            console.log(result);
            if (!result.hash) {
                return;
            }
            // @ts-ignore
            result.wait().then(res => {
                successSignup(signature, message);
            });
        } catch (error: any) {
            console.log("signUpError", error.error);
            if (error.error.message == "execution reverted: User is already signed up") {
                state.signedUp = true;

                // @ts-ignore
                chrome.storage.local.set({ state });
            
                // @ts-ignore
                document.querySelector('aside[xend="signup"]').parentNode.parentNode.style.display = "none";
                await checkURL(false);
                // @ts-ignore
                document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = ""; 
            }
            return;
        }
    }   
}

function getArticles(container: any, articles: { uid: string; comments: ({ author: string; authorUID: string; postID: string; message: string } | { author: string; message: string })[]; imageUrl: string; postID: string; message: string; timestamp: number }[]) {
    let items: string[] = [];

    console.log("getArticles");
    // @ts-ignore
    articles.forEach(row => {
        let tm = Math.ceil((Date.now() - row.timestamp) / 1000) + "s";
        if (parseInt(tm) / 60 >= 1) {
            tm = Math.floor(parseInt(tm) / 60) + "m";
            if (parseInt(tm) / 60 >= 1) {
                tm = Math.floor(parseInt(tm) / 60) + "h";
                if (parseInt(tm) / 24 >= 1) {
                    tm = Math.floor(parseInt(tm) / 24) + "d";
                }
            }
        }

        let content = `
            <div class="xend-ext-dashboard-row">
            <div class="xend-ext-dashboard-column-left"> 
                <div class="xend-ext-dashboard-news">
                    <div class="xend-ext-dashboard-news-time" style="padding-left: 0;">${tm} ago&nbsp;&bullet;</div>
                    <div class="xend-ext-profile-del" data-pid=${row.postID} data-uid=${row.uid}>Delete</div>
                </div>
                <div class="xend-ext-dashboard-news-title" style="word-wrap: break-word;">
                ${row.message}
                </div>
            </div>
            <div class="xend-ext-dashboard-column-right">
                ` + (row.imageUrl ? `<img class="xend-ext-dashboard-avatar" src="${row.imageUrl}" alt="avatar" draggable="false" style="margin-top: 18px;" />` : "") + `
            </div>
            <div style="clear: both"></div>
            ` + createCommentsForm(container, row.postID, row.comments) + `
            </div>
        `;
        items.push(content);
    });
    return items.join("");
}

async function updateFeedPage() {
    console.log("updateFeedPage", state.user.uid);

    let msg = await getFeeds({
        task: "getFeeds",
        uid: state.user.uid,
        token: state.token,
        secret: state.secret,
        start: 0,
        num: state.user.feedPageSize
    });

    if (msg.result === "successGetFeeds") {
        state.user.feedCount = msg.count;
        state.feed = msg.results;

        console.log("successGetFeeds", msg.results);

        // @ts-ignore
        chrome.storage.local.set({ state });
        // @ts-ignore
        document.getElementById("xend-ext-dashboard-profile-feeds").innerHTML = getFeed(msg.results) + `<div id="xend-ext-feed-loader">&nbsp;</div>`;

        // @ts-ignore
        document.querySelectorAll(".xend-ext-feedcomment input").forEach(el => {
            const checkInput = () => {
                // @ts-ignore
                el.nextElementSibling.style.visibility = el.value.trim() === "" ? "hidden" : "visible";
            };
            el.addEventListener("input", checkInput);
            el.addEventListener("change", checkInput);
            el.addEventListener("post", checkInput);
            el.addEventListener("focus", checkInput);
        });

        // @ts-ignore
        document.querySelectorAll(".xend-ext-feedcomment a").forEach(el => {
            el.addEventListener("click", async (e: any) => {
                e.preventDefault();

                console.log("Feed Comment Post");
                // @ts-ignore
                const content = e.target.previousElementSibling.value.trim();
                // @ts-ignore
                const pid = e.target.dataset.pid;
                // @ts-ignore
                const uid = e.target.dataset.uid;
                // @ts-ignore
                let message = await postFeedComment({
                    task: "postFeedComment",
                    content: content,
                    postID: pid,
                    token: state.token,
                    secret: state.secret,
                    articlePosterUID: uid,
                    uid: state.user.uid,
                    start: 0,
                    num: state.feed.length + state.user.feedPageSize
                });
    
                if (message.result === "successPostFeedComment") {
                    console.log("successPostFeedComment: ", message.articles);
                    state.feed = message.articles;

                    updateFeedPage();
        
                    // @ts-ignore
                    chrome.storage.local.set({ state });
                }
            });
        });

        // @ts-ignore
        document.getElementById("xend-ext-dashboard-profile-feeds").addEventListener("scroll", async (e) => {
            if (!state.loadingFeeds && document.querySelector("#xend-ext-feed-loader")
                // @ts-ignore
                && (document.querySelector("#xend-ext-feed-loader").offsetTop <
                    // @ts-ignore
                    document.querySelector("#xend-ext-feed-loader").parentNode.offsetHeight
                    // @ts-ignore
                    + document.querySelector("#xend-ext-feed-loader").parentNode.scrollTop)
            ) {
                state.loadingFeeds = true;
                if (state.feed.length == state.user.feedCount) {
                    state.loadingFeeds = false;
                    return;
                }
                // @ts-ignore
                const scrollTop = document.querySelector("#xend-ext-dashboard-profile-feeds").scrollTop;
                const numOfArticles = document.querySelectorAll("#xend-ext-dashboard-profile-feeds .xend-ext-dashboard-row").length;

                // @ts-ignore
                let message = await getFeeds({
                    task: "getFeeds",
                    uid: state.user.uid,
                    token: state.token,
                    secret: state.secret,
                    start: 0,
                    range: numOfArticles + state.user.feedPageSize
                });

                if (message.result === "successGetFeeds") {
                    if (state.feed.length == message.count || message.results.length == 0) {
                        state.loadingFeeds = false;
                        return;
                    }
                    console.log("successGetFeeds", numOfArticles, message);
                    state.feed = message.results;

                    // @ts-ignore
                    const item = getFeed(message.results);
                    // @ts-ignore
                    document.querySelector("#xend-ext-feed-loader").innerHTML = item + `<div id="xend-ext-feed-loader">&nbsp;</div>`;

                    // @ts-ignore
                    document.querySelectorAll(".xend-ext-feedcomment input").forEach(el => {
                        const checkInput = () => {
                            // @ts-ignore
                            el.nextElementSibling.style.visibility = el.value.trim() === "" ? "hidden" : "visible";
                        };
                        el.addEventListener("input", checkInput);
                        el.addEventListener("change", checkInput);
                        el.addEventListener("post", checkInput);
                        el.addEventListener("focus", checkInput);
                    });

                    // @ts-ignore
                    document.querySelectorAll(".xend-ext-feedcomment a").forEach(el => {
                        el.addEventListener("click", async (e: any) => {
                            e.preventDefault();

                            console.log("Feed Comment Post");
                            // @ts-ignore
                            const content = e.target.previousElementSibling.value.trim();
                            // @ts-ignore
                            const pid = e.target.dataset.pid;
                            // @ts-ignore
                            const uid = e.target.dataset.uid;
                            // @ts-ignore
                            let result = await postFeedComment({
                                task: "postFeedComment",
                                content: content,
                                postID: pid,
                                token: state.token,
                                secret: state.secret,
                                articlePosterUID: uid,
                                uid: state.user.uid,
                                start: state.user.currentRange,
                                num: state.user.pageSize
                            });
            
                            if (result.result === "successPostFeedComment") {
                                console.log("successPostFeedComment: ", result.articles);
                                state.user.articles = result.articles;

                                updateFeedPage();
                    
                                // @ts-ignore
                                chrome.storage.local.set({ state });
                            }
                        });
                    });
                    // @ts-ignore
                    document.querySelector("#xend-ext-dashboard-profile-feeds").scrollTop = scrollTop;
                    state.loadingFeeds = false;

                    // @ts-ignore
                    chrome.storage.local.set({ state });
                }
            }
        });

        // @ts-ignore
        document.querySelector('#content-1').classList.add("selected");
        // @ts-ignore
        document.querySelector('#content-2').classList.remove("selected");
        // @ts-ignore
        document.querySelector('#content-3').classList.remove("selected");
        // @ts-ignore
        document.querySelector('#content-4').classList.remove("selected");
    }
}

async function updateBuySellPageFriendTech() {
    let path = window.location.href;
    const prefix = "https://twitter.com/";
    path = path.slice(path.indexOf(prefix) + prefix.length, path.length);

    let msg = await getFriendTechInfo({
        task: "getFriendTechInfo",
        name: path
    });

    // @ts-ignore
    if (msg.result === "successGetFriendTechInfo") {
        console.log("successGetFriendTechInfo", msg);
        if (msg.id == null) {
            return;
        }

        state.profile.holderNum = msg.holderCount;
        state.profile.keyBalance = msg.shareSupply;
        state.profile.priceInETH = Web3.utils.fromWei(msg.displayPrice, "ether");
        state.profile.keyAddress = msg.address;
        state.profile.keyAvatar = msg.twitterPfpUrl;
        state.profile.keyOwnerName = msg.twitterUsername;
        state.profile.keyId = msg.twitterUserId;
        state.profile.myKeyBalance = msg.balance;

        const WETHPrice = await getTokenPrice(addrTokenWETH);
        console.log("updateBuySellPageFriendTech", WETHPrice);
    
        let usdprice = "";
        usdprice = `$${(Number(state.profile.priceInETH) * WETHPrice).toFixed(2)}`;
        console.log(document.getElementById("xend-ext-menu-usdprice"));
        // @ts-ignore
        document.getElementById("xend-ext-menu-ethprice").innerHTML = (state.profile.priceInETH * 1).toFixed(5);
        // @ts-ignore
        document.getElementById("xend-ext-menu-usdprice").innerHTML = usdprice;
        // @ts-ignore
        document.getElementById("xend-ext-menu-avatar").src = state.profile.keyAvatar;
        // @ts-ignore
        document.getElementById("xend-ext-menu-user").innerHTML = state.profile.keyOwnerName;
        // @ts-ignore
        document.getElementById("xend-ext-menu-holdernum").innerHTML = state.profile.holderNum;
        // @ts-ignore
        document.getElementById("xend-ext-menu-sharessupply").innerHTML = state.profile.keyBalance;
        // @ts-ignore
        document.getElementById("xend-ext-menu-key-input").addEventListener("change", (e: any) => {
            // @ts-ignore
            document.getElementById("xend-ext-menu-key-price").innerHTML = (e.target.value * Number(state.profile.priceInETH)).toFixed(5);
        });
        // @ts-ignore
        document.getElementById("xend-ext-menu-sharesbalance").innerHTML = state.profile.myKeyBalance;

        isPendingBuy = false;
        isPendingSell = false;
        // @ts-ignore
        document.getElementById("xend-ext-menu-key-buy").addEventListener("click", async (e: any) => {
            if (isPendingBuy && isPendingSell) {
                return;
            }
            isPendingBuy = true;
            // @ts-ignore
            document.getElementById("xend-ext-menu-key-buy").disabled = true;
            // @ts-ignore
            document.getElementById("xend-ext-menu-key-buy").classList.add("spinner-button-loading");
            // @ts-ignore
            let amt = (document.getElementById("xend-ext-menu-key-input").value) * 1;
    
            if (amt <= 0) {
                // @ts-ignore
                document.getElementById("xend-ext-menu-key-buy").disabled = false;
                // @ts-ignore
                document.getElementById("xend-ext-menu-key-buy").classList.remove("spinner-button-loading");
                isPendingBuy = false;
                showBuySellModal("Alert", "Please input positive value.");
                return;
            }
    
            const prov = new ethers.providers.Web3Provider(getProvider());
    
            signer = prov.getSigner();
            let friendTechContract = new ethers.Contract(friendTechAddress, friendTechABI, prov);

            try {
                let price = await friendTechContract.connect(signer)["getBuyPriceAfterFee"](state.profile.keyAddress, amt);
    
                const result = await friendTechContract.connect(signer)["buyShares"](state.profile.keyAddress, amt, {
                    value: parseInt(price._hex).toString()
                });
    
                if (!result.hash) {
                    // @ts-ignore
                    document.getElementById("xend-ext-menu-key-buy").disabled = false;
                    // @ts-ignore
                    document.getElementById("xend-ext-menu-key-buy").classList.remove("spinner-button-loading");
                    isPendingBuy = false;
                    showBuySellModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
                    return;
                }
                // @ts-ignore
                result.wait().then(res => {
                    console.log(res);
                    // @ts-ignore
                    if (res.status == 1) {
                        // @ts-ignore
                        document.getElementById("xend-ext-menu-key-buy").disabled = false;
                        // @ts-ignore
                        document.getElementById("xend-ext-menu-key-buy").classList.remove("spinner-button-loading");
                        isPendingBuy = false;
                        setTimeout(() => {
                            checkURL(false);
                        }, 1000);
                    } else {
                        // @ts-ignore
                        document.getElementById("xend-ext-menu-key-buy").disabled = false;
                        // @ts-ignore
                        document.getElementById("xend-ext-menu-key-buy").classList.remove("spinner-button-loading");
                        isPendingBuy = false;
                        showBuySellModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
                    }
                });
            } catch (error) {
                console.log("buyKey", error);
                // @ts-ignore
                document.getElementById("xend-ext-menu-key-buy").disabled = false;
                // @ts-ignore
                document.getElementById("xend-ext-menu-key-buy").classList.remove("spinner-button-loading");
                isPendingBuy = false;
                showBuySellModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
            }
        });

        // @ts-ignore
        document.getElementById("xend-ext-menu-key-sell").addEventListener("click", async (e: any) => {
            if (isPendingSell && isPendingBuy) {
                return;
            }
            isPendingSell = true;
            // @ts-ignore
            document.getElementById("xend-ext-menu-key-sell").disabled = true;
            // @ts-ignore
            document.getElementById("xend-ext-menu-key-sell").classList.add("spinner-button-loading");
            // @ts-ignore
            let amt = (document.getElementById("xend-ext-menu-key-input").value) * 1;
    
            if (amt <= 0) {
                // @ts-ignore
                document.getElementById("xend-ext-menu-key-sell").disabled = false;
                // @ts-ignore
                document.getElementById("xend-ext-menu-key-sell").classList.remove("spinner-button-loading");
                isPendingSell = false;
                showBuySellModal("Alert", "Please input positive value.");
                return;
            }
    
            const prov = new ethers.providers.Web3Provider(getProvider());
    
            signer = prov.getSigner();
            let friendTechContract = new ethers.Contract(friendTechAddress, friendTechABI, prov);

            try {
                let price = await friendTechContract.connect(signer)["getSellPriceAfterFee"](state.profile.keyAddress, amt);
    
                const result = await friendTechContract.connect(signer)["sellShares"](state.profile.keyAddress, amt, {
                    value: parseInt(price._hex).toString()
                });
    
                if (!result.hash) {
                    // @ts-ignore
                    document.getElementById("xend-ext-menu-key-sell").disabled = false;
                    // @ts-ignore
                    document.getElementById("xend-ext-menu-key-sell").classList.remove("spinner-button-loading");
                    isPendingSell = false;
                    showBuySellModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
                    return;
                }
                // @ts-ignore
                result.wait().then(res => {
                    console.log(res);
                    // @ts-ignore
                    if (res.status == 1) {
                        // @ts-ignore
                        document.getElementById("xend-ext-menu-key-sell").disabled = false;
                        // @ts-ignore
                        document.getElementById("xend-ext-menu-key-sell").classList.remove("spinner-button-loading");
                        isPendingSell = false;
                        
                        setTimeout(() => {
                            checkURL(false);
                        }, 1000);
                    } else {
                        // @ts-ignore
                        document.getElementById("xend-ext-menu-key-sell").disabled = false;
                        // @ts-ignore
                        document.getElementById("xend-ext-menu-key-sell").classList.remove("spinner-button-loading");
                        isPendingSell = false;
                        showBuySellModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
                    }
                });
            } catch (error) {
                console.log("sellKey", error);
                // @ts-ignore
                document.getElementById("xend-ext-menu-key-sell").disabled = false;
                // @ts-ignore
                document.getElementById("xend-ext-menu-key-sell").classList.remove("spinner-button-loading");
                isPendingSell = false;
                showBuySellModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
            }
        });

        // @ts-ignore
        chrome.storage.local.set({ state });

        // @ts-ignore
        document.getElementById("xend-ext-menu-up-trend-wrapper").style.display = "none";
        // @ts-ignore
        document.getElementById("xend-ext-menu-premium-btn").disabled = true;
        // @ts-ignore
        document.getElementById("xend-ext-menu-premium-btn-text").text = "Disabled";
    }
}

const updateBuySellPageXend = async () => {
    const WETHPrice = await getTokenPrice(addrTokenWETH);
    console.log("updateBuySellPageXend", WETHPrice);

    let usdprice = "";
    usdprice = `$${(Number(state.profile.priceInETH) * WETHPrice).toFixed(2)}`;
    console.log(document.getElementById("xend-ext-menu-usdprice"));
    // @ts-ignore
    document.getElementById("xend-ext-menu-ethprice").innerHTML = (state.profile.priceInETH * 1).toFixed(5);
    // @ts-ignore
    document.getElementById("xend-ext-menu-usdprice").innerHTML = usdprice;
    // @ts-ignore
    document.getElementById("xend-ext-menu-avatar").src = state.profile.keyAvatar;
    // @ts-ignore
    document.getElementById("xend-ext-menu-user").innerHTML = state.profile.keyOwnerName;
    // @ts-ignore
    document.getElementById("xend-ext-menu-sharesbalance").innerHTML = state.profile.myKeyBalance;
    // @ts-ignore
    document.getElementById("xend-ext-menu-holdernum").innerHTML = state.profile.holderNum;
    // @ts-ignore
    document.getElementById("xend-ext-menu-sharessupply").innerHTML = state.profile.keyBalance;
    // @ts-ignore
    document.getElementById("xend-ext-menu-up-trend").innerHTML = state.profile.changeRate;

    // @ts-ignore
    document.getElementById("xend-ext-menu-key-input").addEventListener("change", (e: any) => {
        // @ts-ignore
        document.getElementById("xend-ext-menu-key-price").innerHTML = (e.target.value * Number(state.profile.priceInETH)).toFixed(5);
    });

    try {
        const provider = new ethers.providers.Web3Provider(getProvider());

        signer = provider.getSigner();
        subscribeContract = new ethers.Contract(subscribeAddress, subscribeABI, provider);

        const isEnabled = await subscribeContract.connect(signer)["isMonthlySubscriptionEnabled"](state.profile.keyAddress);
        console.log("subscribe", isEnabled);
        state.profile.isSubscriptionEnabled = isEnabled;

        if (isEnabled && state.user.address != state.profile.keyAddress && !state.profile.isSubscribed) {
            const result = await subscribeContract.connect(signer)["monthlySubPrice"](state.profile.keyAddress);
            state.profile.subscribePriceInETH = result;
            console.log("subscribePrice", result);

            // @ts-ignore
            document.getElementById("xend-ext-menu-premium-btn-text").innerHTML = `1 Month • ${state.profile.subscribePriceInETH} ETH`;
        } else {
            // @ts-ignore
            document.getElementById("xend-ext-menu-premium-btn-text").innerHTML = `Disabled`;
            // @ts-ignore
            document.getElementById("xend-ext-menu-premium-btn").disabled = true;
            // @ts-ignore
            document.getElementById("xend-ext-menu-premium").style.opacity = "50% !important";                        
        }

        // @ts-ignore
        chrome.storage.local.set({ state });
    } catch (error: any) {
        console.log("updateBuySellPageXend", error);
    }

    // @ts-ignore
    document.getElementById("xend-ext-menu-premium-btn").addEventListener("click", async (e: any) => {
        if (isPendingSubscribe) {
            return;
        }
        isPendingSubscribe = true;
        // @ts-ignore
        document.getElementById("xend-ext-menu-premium-btn").disabled = true;
        // @ts-ignore
        document.getElementById("xend-ext-menu-premium-btn").classList.add("spinner-button-loading");

        const provider = new ethers.providers.Web3Provider(getProvider());

        signer = provider.getSigner();
        subscribeContract = new ethers.Contract(subscribeAddress, subscribeABI, provider);

        try {
            const price = await subscribeContract.connect(signer)["monthlySubPrice"](state.profile.keyAddress);
            const result = await subscribeContract.connect(signer)["subscribe"](state.profile.keyAddress, {
                value: parseInt(price._hex).toString()
            });

            if (!result.hash) {
                isPendingSubscribe = false;
                // @ts-ignore
                document.getElementById("xend-ext-menu-premium-btn").disabled = false;
                // @ts-ignore
                document.getElementById("xend-ext-menu-premium-btn").classList.remove("spinner-button-loading");
                showBuySellModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
                return;
            }
            // @ts-ignore
            result.wait().then(res => {
                if (res.status) {
                    isPendingSubscribe = false;
                    // @ts-ignore
                    document.getElementById("xend-ext-menu-premium-btn").disabled = false;
                    // @ts-ignore
                    document.getElementById("xend-ext-menu-premium-btn-text").text = "Subscribed";
                    // @ts-ignore
                    document.getElementById("xend-ext-menu-premium-btn").classList.remove("spinner-button-loading");
                } else {
                    isPendingSubscribe = false;
                    // @ts-ignore
                    document.getElementById("xend-ext-menu-premium-btn").disabled = false;
                    // @ts-ignore
                    document.getElementById("xend-ext-menu-premium-btn").classList.remove("spinner-button-loading");
                    showBuySellModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
                }
            });
        } catch (error) {
            console.log("subscribeError", error);
            isPendingSubscribe = false;
            // @ts-ignore
            document.getElementById("xend-ext-menu-premium-btn").disabled = false;
            // @ts-ignore
            document.getElementById("xend-ext-menu-premium-btn").classList.remove("spinner-button-loading");
            showBuySellModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
        }
    });

    // @ts-ignore
    document.getElementById("xend-ext-menu-key-buy").addEventListener("click", async (e: any) => {
        if (isPendingBuy && isPendingSell) {
            return;
        }
        isPendingBuy = true;
        // @ts-ignore
        document.getElementById("xend-ext-menu-key-buy").disabled = true;
        // @ts-ignore
        document.getElementById("xend-ext-menu-key-buy").classList.add("spinner-button-loading");
        // @ts-ignore
        let amt = (document.getElementById("xend-ext-menu-key-input").value) * 1;

        if (amt <= 0) {
            // @ts-ignore
            document.getElementById("xend-ext-menu-key-buy").disabled = false;
            // @ts-ignore
            document.getElementById("xend-ext-menu-key-buy").classList.remove("spinner-button-loading");
            isPendingBuy = false;
            showBuySellModal("Alert", "Please input positive value.");
            return;
        }

        const prov = new ethers.providers.Web3Provider(getProvider());

        signer = prov.getSigner();
        xendContract = new ethers.Contract(address, abi, prov);

        try {
            let price = await xendContract.connect(signer)["getBuyPriceAfterFee"](state.profile.keyAddress, amt);

            const result = await xendContract.connect(signer)["buyShares"](state.profile.keyAddress, amt, {
                value: parseInt(price._hex).toString()
            });

            if (!result.hash) {
                // @ts-ignore
                document.getElementById("xend-ext-menu-key-buy").disabled = false;
                // @ts-ignore
                document.getElementById("xend-ext-menu-key-buy").classList.remove("spinner-button-loading");
                isPendingBuy = false;
                showBuySellModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
                return;
            }
            // @ts-ignore
            result.wait().then(res => {
                console.log(res);
                // @ts-ignore
                if (res.status == 1) {
                    // @ts-ignore
                    document.getElementById("xend-ext-menu-key-buy").disabled = false;
                    // @ts-ignore
                    document.getElementById("xend-ext-menu-key-buy").classList.remove("spinner-button-loading");
                    isPendingBuy = false;
                    
                    setTimeout(() => {
                        checkURL(false);
                    }, 1000);
                } else {
                    // @ts-ignore
                    document.getElementById("xend-ext-menu-key-buy").disabled = false;
                    // @ts-ignore
                    document.getElementById("xend-ext-menu-key-buy").classList.remove("spinner-button-loading");
                    isPendingBuy = false;
                    showBuySellModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
                }
            });
        } catch (error) {
            console.log("buyKey", error);
            // @ts-ignore
            document.getElementById("xend-ext-menu-key-buy").disabled = false;
            // @ts-ignore
            document.getElementById("xend-ext-menu-key-buy").classList.remove("spinner-button-loading");
            isPendingBuy = false;
            showBuySellModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
        }
    });

    // @ts-ignore
    document.getElementById("xend-ext-menu-key-sell").addEventListener("click", async (e: any) => {
        if (isPendingSell && isPendingBuy) {
            return;
        }
        isPendingSell = true;
        // @ts-ignore
        document.getElementById("xend-ext-menu-key-sell").disabled = true;
        // @ts-ignore
        document.getElementById("xend-ext-menu-key-sell").classList.add("spinner-button-loading");
        // @ts-ignore
        let amt = (document.getElementById("xend-ext-menu-key-input").value) * 1;

        if (amt <= 0) {
            // @ts-ignore
            document.getElementById("xend-ext-menu-key-sell").disabled = false;
            // @ts-ignore
            document.getElementById("xend-ext-menu-key-sell").classList.remove("spinner-button-loading");
            isPendingSell = false;
            showBuySellModal("Alert", "Please input positive value.");
            return;
        }

        const prov = new ethers.providers.Web3Provider(getProvider());

        signer = prov.getSigner();
        xendContract = new ethers.Contract(address, abi, prov);

        try {
            let price = await xendContract.connect(signer)["getSellPriceAfterFee"](state.profile.keyAddress, amt);

            const result = await xendContract.connect(signer)["sellShares"](state.profile.keyAddress, amt, {
                value: parseInt(price._hex).toString()
            });

            if (!result.hash) {
                // @ts-ignore
                document.getElementById("xend-ext-menu-key-sell").disabled = false;
                // @ts-ignore
                document.getElementById("xend-ext-menu-key-sell").classList.remove("spinner-button-loading");
                isPendingSell = false;
                showBuySellModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
                return;
            }
            // @ts-ignore
            result.wait().then(res => {
                console.log(res);
                // @ts-ignore
                if (res.status == 1) {
                    // @ts-ignore
                    document.getElementById("xend-ext-menu-key-sell").disabled = false;
                    // @ts-ignore
                    document.getElementById("xend-ext-menu-key-sell").classList.remove("spinner-button-loading");
                    isPendingSell = false;
                   
                    setTimeout(() => {
                        checkURL(false);
                    }, 1000);
                } else {
                    // @ts-ignore
                    document.getElementById("xend-ext-menu-key-sell").disabled = false;
                    // @ts-ignore
                    document.getElementById("xend-ext-menu-key-sell").classList.remove("spinner-button-loading");
                    isPendingSell = false;
                    showBuySellModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
                }
            });
        } catch (error) {
            console.log("sellKey", error);
            // @ts-ignore
            document.getElementById("xend-ext-menu-key-sell").disabled = false;
            // @ts-ignore
            document.getElementById("xend-ext-menu-key-sell").classList.remove("spinner-button-loading");
            isPendingSell = false;
            showBuySellModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
        }
    });

    // @ts-ignore
    chrome.storage.local.set({ state });
}

//////////////////////////////////////////////////////////////////  
function createLogin(node: any) {
    console.log("createLogin");
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
    const para = document.querySelector("body");
    // @ts-ignore
    const compStyles = window.getComputedStyle(para);
    const darkModeStyle = compStyles.backgroundColor == 'rgb(255, 255, 255)' ? false : true;

    node.style.height = '200px';
    if (state.authorized) {
        node.style.display = 'none';
    }
    node.getElementsByTagName('aside')[0].setAttribute('xend', 'login');
    if (node.getElementsByTagName('span')[0]) {
        node.getElementsByTagName('span')[0].remove();
    }
    if (node.getElementsByTagName('h2')[0]) {
        node.getElementsByTagName('h2')[0].remove();
    }

    let logo;
    const container = document.createElement('div');
    container.style.opacity = "0";
    container.style.transition = "opacity .3s";
    container.classList.add("xend-ext-container");
    if (darkMode.matches || darkModeStyle) {
        container.classList.add("xend-ext-dark");
        logo = logoW
    } else {
        container.classList.add("xend-ext-white");
        // @ts-ignore
        document.querySelector(':root').style.setProperty('--xendwhite', '#333333');
        logo = logoB
    }

    const pageTpl = `
    <img class="xend-ext-logo-img" src="${logo}" alt="logo" draggable="false" />
    <button id="xend-ext-logo-btn"></button>
    `;
    container.innerHTML = pageTpl;

    const aside = node.getElementsByTagName('aside')[0];
    aside.replaceChildren(aside.children[0]);
    aside.getElementsByTagName('div')[0].appendChild(container);

    // @ts-ignore
    container.querySelector("#xend-ext-logo-btn").addEventListener("click", e => {
        login();
    });
}

function createWalletConnect(node: any) {
    console.log("createWalletConnect");
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
    const para = document.querySelector("body");
    // @ts-ignore
    const compStyles = window.getComputedStyle(para);
    const darkModeStyle = compStyles.backgroundColor == 'rgb(255, 255, 255)' ? false : true;

    node.style.height = '280px';
    node.style.position = "relative";
    if (!state.authorized || state.walletConnected) {
        node.style.display = 'none';
    }
    node.getElementsByTagName('aside')[0].setAttribute('xend', 'wallet');
    if (node.getElementsByTagName('span')[0]) {
        node.getElementsByTagName('span')[0].remove();
    }
    if (node.getElementsByTagName('h2')[0]) {
        node.getElementsByTagName('h2')[0].remove();
    }

    const container = document.createElement('div');
    container.style.opacity = "0";
    container.style.transition = "opacity .3s";
    container.classList.add("xend-ext-container");
    if (darkMode.matches || darkModeStyle) {
        container.classList.add("xend-ext-dark");
    } else {
        container.classList.add("xend-ext-white");
        // @ts-ignore
        document.querySelector(':root').style.setProperty('--xendwhite', '#333333');
    }

    const pageTpl = `
    <img id="xend-ext-wallet-avatar" class="xend-ext-wallet-avatar" src="${state.user.avatar}" alt="avatar" draggable="false" />
    <div id="xend-ext-wallet-user" class="xend-ext-wallet-user">${state.user.name}</div>
    <button id="xend-ext-wallet-connect-btn"></button>
    <div id="walletModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <div class="modal-icon"></div>
                <p id="walletModalHeaderTxt" class="modal-header-text">Wrong wallet</p>
            </div>
            <p id="walletModalMainTxt" class="modal-main-text">
                Connect your paired XEND wallet, 0x1041...3234 to continue.
            </p>
            <button id="walletModalCloseBtn" class="modal-close-button">Close</button>
        </div>
    </div>
    `;
    container.innerHTML = pageTpl;

    const aside = node.getElementsByTagName('aside')[0];
    aside.replaceChildren(aside.children[0]);
    aside.getElementsByTagName('div')[0].appendChild(container);

    // @ts-ignore
    container.querySelector("#walletModalCloseBtn").addEventListener("click", (e) => {
        // @ts-ignore
        container.querySelector("#walletModal").style.display = "none";
    });
    // @ts-ignore
    container.querySelector("#walletModal").style.display = "none";
    // @ts-ignore
    container.querySelector("#xend-ext-wallet-connect-btn").addEventListener("click", e => {
        connectWallet();
    });
}

function createSignUp(node: any) {
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
    const para = document.querySelector("body");
    // @ts-ignore
    const compStyles = window.getComputedStyle(para);
    const darkModeStyle = compStyles.backgroundColor == 'rgb(255, 255, 255)' ? false : true;

    node.style.height = '350px';
    if (!state.authorized || !state.walletConnected || state.signedUp) {
        node.style.display = 'none';
    }
    node.getElementsByTagName('aside')[0].setAttribute('xend', 'signup');
    if (node.getElementsByTagName('span')[0]) {
        node.getElementsByTagName('span')[0].remove();
    }
    if (node.getElementsByTagName('h2')[0]) {
        node.getElementsByTagName('h2')[0].remove();
    }

    const container = document.createElement('div');
    container.style.opacity = "0";
    container.style.transition = "opacity .3s";
    container.classList.add("xend-ext-container");
    if (darkMode.matches || darkModeStyle) {
        container.classList.add("xend-ext-dark");
    } else {
        container.classList.add("xend-ext-white");
        // @ts-ignore
        document.querySelector(':root').style.setProperty('--xendwhite', '#333333');
    }

    const pageTpl = `
    <img id="xend-ext-signup-avatar" class="xend-ext-signup-avatar" src="${state.user.avatar}" alt="avatar" draggable="false" />
    <div id="xend-ext-signup-user" class="xend-ext-signup-user">${state.user.name}</div>
    <div class="xend-ext-signup-referrer">
        <div id="xend-ext-signup-referrer-label">Referrer (optional)</div>
        <input type="text" placeholder="X Username" id="xend-ext-signup-referrer-name" class="xend-ext-signup-referrer-name" />
        <div id="xend-ext-signup-referrer-alert"></div>
    </div>
    <button id="xend-ext-signup-btn">SignUp</button>
    `;
    container.innerHTML = pageTpl;

    const aside = node.getElementsByTagName('aside')[0];
    aside.replaceChildren(aside.children[0]);
    aside.getElementsByTagName('div')[0].appendChild(container);

    // @ts-ignore
    container.querySelector("#xend-ext-signup-btn").addEventListener("click", e => {
        signUp();
    });
}

function createDashboard(node: any) {
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
    const para = document.querySelector("body");
    // @ts-ignore
    const compStyles = window.getComputedStyle(para);
    const darkModeStyle = compStyles.backgroundColor == 'rgb(255, 255, 255)' ? false : true;

    node.style.height = '410px';
    if (!state.authorized || !state.walletConnected || !state.signedUp) {
        node.style.display = 'none';
    }
    node.getElementsByTagName('aside')[0].setAttribute('xend', 'dashboard');
    if (node.getElementsByTagName('span')[0]) {
        node.getElementsByTagName('span')[0].remove();
    }
    if (node.getElementsByTagName('h2')[0]) {
        node.getElementsByTagName('h2')[0].remove();
    }

    const container = document.createElement('div');
    container.style.opacity = "0";
    container.style.transition = "opacity .3s";
    container.classList.add("xend-ext-container");
    if (darkMode.matches || darkModeStyle) {
        container.classList.add("xend-ext-dark");
    } else {
        container.classList.add("xend-ext-white");
        // @ts-ignore
        document.querySelector(':root').style.setProperty('--xendwhite', '#333333');
    }

    const pageTpl = `
        <div class="xend-ext-dashboard-header">
            <div>Dashboard</div>
            <div class="xend-ext-dashboard-setting">
                <div id="xend-ext-dashboard-warning" class="tooltip">
                    <span id="xend-ext-dashboard-warningmsg" class="tooltiptext">
                        Wrong wallet connected on Metamask
                    </span>
                </div>
                <button id="xend-ext-dashboard-settings-btn" title="Settings"><img id="xend-ext-dashboard-setting-avatar" src="${state.user.avatar}" alt="" draggable="false" /></button>
            </div>
        </div>
        
        <div class="tabs">
        <div id="content-1" class="selected">
            <div id="xend-ext-dashboard-profile-feeds">
                ` + getFeed(state.feed) + `
                <div id="xend-ext-feed-loader">&nbsp;</div>
            </div>
        </div>

        <div id="content-2">
        ` + getKeys(container, { ...state.key, keys: state.keys }) + ` 
        </div>


        <div id="content-3">
            <div class="xend-ext-dashboard-profile">
                <textarea id="xendExtPostContent">So nice i had to post it twice</textarea>
                <div class="xend-ext-dashboard-profile-file" title="Upload file"><label title="Add Image"><input id="addFile" type="file" /></label><button title="Remove Image" id="removeFile">&times;</button></div>
                <button id="xend-ext-dashboard-profile-post">
                    Post
                </button>
                <div style="clear: both"></div>
            </div>
            <div id="xend-ext-dashboard-profile-articles"> ` + getArticles(container, state.user.articles) + `</div>
        </div>
        
        <div id="content-4">
        <iframe src="https://www.friend.tech/"></iframe>
        </div>
        
        <div class="tabs__links">
            <a href="#content-1">Feed</a>
            <a href="#content-2">Keys</a>
            <a href="#content-3">Profile</a>
            <a href="#content-4">FT</a>
        
        </div>
        </div>    
    `;
    container.innerHTML = pageTpl;

    const aside = node.getElementsByTagName('aside')[0];
    aside.replaceChildren(aside.children[0]);
    aside.getElementsByTagName('div')[0].appendChild(container);

    // @ts-ignore
    container.querySelector("#xend-ext-dashboard-warning").style.visibility = "hidden";
    // @ts-ignore
    container.querySelector('a[href="#content-1"]').addEventListener("click", (e) => {
        console.log("Show Feed Page");
        e.preventDefault();
        updateFeedPage();
    });
    // @ts-ignore
    container.querySelector('a[href="#content-2"]').addEventListener("click", async (e) => {
        e.preventDefault();

        console.log("Show Keys Page");

        let msg = await getMyKeys({
            task: "getMyKeys",
            uid: state.user.uid,
            token: state.token,
            secret: state.secret,
        });

        if (msg.result === "successGetMyKeys") {
            // @ts-ignore
            state.key.keyBalance = msg.keyBalance;
            // @ts-ignore
            state.key.holderNum = msg.holderNum;
            // @ts-ignore
            state.key.priceInETH = msg.priceInETH;
            // @ts-ignore
            state.key.totalPrice = msg.totalPrice;

            state.keys = msg.myKeys;

            // @ts-ignore
            chrome.storage.local.set({ state });

            updateKeysPage();
        }

        // @ts-ignore
        container.querySelector('#content-2').classList.add("selected");
        // @ts-ignore
        container.querySelector('#content-1').classList.remove("selected");
        // @ts-ignore
        container.querySelector('#content-3').classList.remove("selected");
        // @ts-ignore
        container.querySelector('#content-4').classList.remove("selected");
    });

    // @ts-ignore
    container.addEventListener("input", e => {
       console.log("input");
    });

    container.addEventListener("click", async (e) => {
        // @ts-ignore
        if (e.target.className == "xend-ext-view-comments") {
            e.preventDefault();
            // @ts-ignore
            e.target.style.display = "none";
            // @ts-ignore
            e.target.nextElementSibling.style.display = "block";
            // @ts-ignore
        } else if (e.target.className == "xend-ext-profile-del") {
            e.preventDefault();
            console.log("delete");
            // @ts-ignore
            console.log(e.target.dataset);
            // @ts-ignore
            let pid = e.target.dataset.pid;
            // @ts-ignore
            let uid = e.target.dataset.uid;

            let message = await deleteArticle({
                task: "deleteArticle",
                postID: pid,
                uid: uid,
                token: state.token,
                secret: state.secret,
                articlePosterUID: uid,
                start: state.user.currentRange,
                num: state.user.pageSize
            });

            if (message.result === "successDeleteArticle") {
                console.log("successDeleteArticle: ", message.articles);
                state.user.articles = message.articles;
                state.user.articleCount = message.count;
                state.user.currentRange = message.start;

                updateProfilePage();

                // @ts-ignore
                chrome.storage.local.set({ state });
            }
        }
    });

    const updateKeysPage = () => {
        console.log("updateKeysPage");

        let keys = [];
        let last = state.keys.length > (state.keysPageInfo.pageSize + state.keysPageInfo.currentRange) ? state.keysPageInfo.pageSize : state.keys.length - state.keysPageInfo.currentRange;
        for (let i = 0; i < last; i++) {
            keys.push({
                // @ts-ignore
                ...state.keys[state.keysPageInfo.currentRange + i]
            });
        }
        let data = { ...state.key, keys };
        data.avatar = state.user.avatar;
        const item = getKeys(container, data);

        // @ts-ignore
        document.getElementById("content-2").innerHTML = item;

        // @ts-ignore
        document.getElementById("xend-ext-dashboard-row-container").addEventListener("scroll", e => {
            if (!state.loadingArticles && document.querySelector("#xend-ext-keys-loader")
                // @ts-ignore
                && (document.querySelector("#xend-ext-keys-loader").offsetTop <
                    // @ts-ignore
                    document.querySelector("#xend-ext-keys-loader").parentNode.offsetHeight
                    // @ts-ignore
                    + document.querySelector("#xend-ext-keys-loader").parentNode.scrollTop)
            ) {
                state.loadingArticles = true;
                // @ts-ignore
                const scrollTop = document.querySelector("#xend-ext-dashboard-row-container").scrollTop;
                const numOfKeys = document.querySelectorAll("#xend-ext-dashboard-row-container .xend-ext-dashboard-row").length;

                let keys = [];
                            
                console.log(numOfKeys, scrollTop);

                for (let i = numOfKeys; i < state.keys.length; i++) {
                    // @ts-ignore
                    keys.push({ ...state.keys[i] });
                    if (keys.length == state.keysPageInfo.pageSize) {
                        break;
                    }
                }

                console.log(keys);
                const content = getKeyArray({ keys });
                console.log(content);

                // @ts-ignore
                document.getElementById("xend-ext-dashboard-row-container").innerHTML += content; 
                // @ts-ignore
                document.getElementById("xend-ext-dashboard-row-container").scrollTop = scrollTop;

                state.loadingArticles = false;
            }
        });
    }

    const updateSettingsPage = async () => {
        try {
            const provider = new ethers.providers.Web3Provider(getProvider());
    
            signer = provider.getSigner();
            subscribeContract = new ethers.Contract(subscribeAddress, subscribeABI, provider);
    
            const isEnabled = await subscribeContract.connect(signer)["isMonthlySubscriptionEnabled"](state.user.address);

            state.user.isSubscriptionEnabled = isEnabled;
    
            let msg = await getCompatibility({
                task: "getCompatibility",
                uid: state.user.uid,
                token: state.token,
                secret: state.secret
            });

            if (msg.result === "successGetCompatibility") {
                console.log("successGetCompatibility: ", msg.isCompatibility);
                // @ts-ignore
                document.getElementById("xendExtFriendTechCheckbox").checked = msg.isCompatibility;

                state.user.isCompatibility = msg.isCompatibility;

                // @ts-ignore
                chrome.storage.local.set({ state: state });
    
                // @ts-ignore
                document.getElementById("xendExtSettingsPrice").text = `${state.user.subscribePriceInETH} ETH`;
                // @ts-ignore
                document.getElementById("xendExtSubscriptionPrice").value = state.user.subscribePriceInETH;
                // @ts-ignore
                document.getElementById("xendExtSubscriptionCheckbox").checked = isEnabled;
    
                if (isEnabled) {
                    // @ts-ignore
                    document.getElementById("xendExtSubscriptionCheckbox").disabled = true;
                }
    
                // @ts-ignore
                document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "none";
                // @ts-ignore
                document.querySelector('aside[xend="settings"]').parentNode.parentNode.style.display = "";
            }
        } catch (error: any) {
            console.log("updateSettingsPage", error);
        }
    }

    const updateProfilePage = () => {
        if (state.file != "") {
            // @ts-ignore
            state.file = "";
            // @ts-ignore
            document.getElementById("addFile").value = null;
            // @ts-ignore
            document.getElementById('removeFile').style.backgroundImage = "";
            // @ts-ignore
            document.getElementById('removeFile').style.visibility = "hidden";
        }
        
        const item = getArticles(container, state.user.articles);
        // @ts-ignore
        document.getElementById("xend-ext-dashboard-profile-articles").innerHTML = item + `<div id="xend-ext-articles-loader">&nbsp;</div>`;

        // @ts-ignore
        container.querySelectorAll(".xend-ext-comment input").forEach(el => {
            const checkInput = () => {
                // @ts-ignore
                el.nextElementSibling.style.visibility = el.value.trim() === "" ? "hidden" : "visible";
            };
            el.addEventListener("input", checkInput);
            el.addEventListener("change", checkInput);
            el.addEventListener("post", checkInput);
            el.addEventListener("focus", checkInput);
        });

        // @ts-ignore
        container.querySelectorAll(".xend-ext-comment a").forEach(el => {
            el.addEventListener("click", async (e) => {
                e.preventDefault();
                // @ts-ignore
                const content = e.target.previousElementSibling.value.trim();
                // @ts-ignore
                const pid = e.target.dataset.pid;
                // @ts-ignore
                let msg = await postComment({
                    task: "postComment",
                    content: content,
                    postID: pid,
                    token: state.token,
                    secret: state.secret,
                    articlePosterUID: state.user.uid,
                    uid: state.user.uid,
                    start: state.user.currentRange,
                    num: state.user.pageSize
                });

                if (msg.result === "successPostComment") {
                    console.log("successPostComment: ", msg.articles);
                    state.user.articles = msg.articles;

                    updateProfilePage();
        
                    // @ts-ignore
                    chrome.storage.local.set({ state });
                }
            });
        });
    }

    // @ts-ignore
    container.querySelector('a[href="#content-3"]').addEventListener("click", async (e) => {
        console.log("Show Profile Page");
        e.preventDefault();

        // @ts-ignore
        let msg = await openProfilePage({
            task: "openProfilePage",
            uid: state.user.uid,
            token: state.token,
            secret: state.secret,
            range: state.user.pageSize
        });

        if (msg.result === "setArticleCount") {
            console.log("setArticleCount", state);
            // @ts-ignore
            state.user.articleCount = msg.count;
            state.user.currentRange = 0;
            state.user.articles = msg.articles;

            console.log("setArticleCount", msg.count);

            updateProfilePage();

            // @ts-ignore
            chrome.storage.local.set({ state });

            // @ts-ignore
            container.querySelector('#content-3').classList.add("selected");
            // @ts-ignore
            container.querySelector('#content-1').classList.remove("selected");
            // @ts-ignore
            container.querySelector('#content-2').classList.remove("selected");
            // @ts-ignore
            container.querySelector('#content-4').classList.remove("selected");
        }
    });
    // @ts-ignore
    container.querySelector('a[href="#content-4"]').addEventListener("click", (e) => {
        e.preventDefault();
        // @ts-ignore
        container.querySelector('#content-4').classList.add("selected");
        // @ts-ignore
        container.querySelector('#content-1').classList.remove("selected");
        // @ts-ignore
        container.querySelector('#content-2').classList.remove("selected");
        // @ts-ignore
        container.querySelector('#content-3').classList.remove("selected");
    });

    // @ts-ignore
    container.querySelector("#xend-ext-dashboard-settings-btn").addEventListener("click", (e) => {
        updateSettingsPage();
    });

    // @ts-ignore
    container.querySelectorAll(".xend-ext-view-comments").forEach(el => {
        el.addEventListener("click", e => {
            e.preventDefault();
            // @ts-ignore
            e.target.style.display = "none";
            // @ts-ignore
            e.target.nextElementSibling.style.display = "block";
        });
    });

    // @ts-ignore
    container.querySelectorAll(".xend-ext-comment input").forEach(el => {
        const checkInput = () => {
            // @ts-ignore
            el.nextElementSibling.style.visibility = el.value.trim() === "" ? "hidden" : "visible";
        };
        el.addEventListener("input", checkInput);
        el.addEventListener("change", checkInput);
        el.addEventListener("post", checkInput);
        el.addEventListener("focus", checkInput);
    });

    // @ts-ignore
    container.querySelector("#addFile").addEventListener("change", e => {
        // @ts-ignore
        let file = e.target.files[0];
        state.file = file;

        const reader = new FileReader();
        reader.onload = async (event) => {
            // @ts-ignore
            document.getElementById('removeFile').style.backgroundImage = `url(${event.target.result})`;
            // @ts-ignore
            document.getElementById('removeFile').style.visibility = "visible";
        }
        reader.readAsDataURL(file);
    });

    // @ts-ignore
    container.querySelector("#removeFile").addEventListener("click", e => {
        // @ts-ignore
        state.file = "";
        // @ts-ignore
        document.getElementById("addFile").value = null;
        // @ts-ignore
        document.getElementById('removeFile').style.backgroundImage = "";
        // @ts-ignore
        document.getElementById('removeFile').style.visibility = "hidden";
    });

    // @ts-ignore
    container.querySelector("#xend-ext-dashboard-profile-post").addEventListener("click", async (e) => {
        console.log("Post Article");
        // @ts-ignore
        const content = document.querySelector("#xendExtPostContent").value.trim();
        let msg = null;
        // @ts-ignore
        if (document.getElementById("addFile").value) {
            // @ts-ignore
            let file = document.getElementById("addFile").files[0];
            const reader = new FileReader();
            reader.onload = async (event) => {
                // @ts-ignore
                msg = await postArticle({
                    task: "postArticle",
                    // @ts-ignore
                    image: event.target.result,
                    content: content,
                    uid: state.user.uid,
                    token: state.token,
                    secret: state.secret,
                    // @ts-ignore
                    type: state.file.type,
                    range: state.user.pageSize
                });

                if (msg.result === "successPostArticle") {
                    console.log("successPostArticle: ", msg.count, msg.articles);
                    state.user.articleCount = msg.count;
                    state.user.articles = msg.articles;
                    state.user.currentRange = msg.start;
        
                    updateProfilePage();
        
                    // @ts-ignore
                    chrome.storage.local.set({
                        state: state
                    });
                }
            }
            reader.readAsDataURL(file);
        } else {
            // @ts-ignore
            msg = await postArticle({
                task: "postArticle",
                image: "",
                content: content,
                uid: state.user.uid,
                token: state.token,
                secret: state.secret,
                type: "",
                range: state.user.pageSize
            });

            if (msg.result === "successPostArticle") {
                console.log("successPostArticle: ", msg.count, msg.articles);
                state.user.articleCount = msg.count;
                state.user.articles = msg.articles;
                state.user.currentRange = msg.start;
    
                updateProfilePage();
    
                // @ts-ignore
                chrome.storage.local.set({
                    state: state
                });
            }
        }
    });

    // @ts-ignore
    container.querySelector("#xend-ext-dashboard-profile-articles").addEventListener("scroll", async (e) => {
        if (!state.loadingArticles && document.querySelector("#xend-ext-articles-loader")
            // @ts-ignore
            && (document.querySelector("#xend-ext-articles-loader").offsetTop <
                // @ts-ignore
                document.querySelector("#xend-ext-articles-loader").parentNode.offsetHeight
                // @ts-ignore
                + document.querySelector("#xend-ext-articles-loader").parentNode.scrollTop)
        ) {
            if (state.user.articleCount == state.user.articles.length) {
                return;
            }

            state.loadingArticles = true;
            // @ts-ignore
            const scrollTop = document.querySelector("#xend-ext-dashboard-profile-articles").scrollTop;
            const numOfArticles = document.querySelectorAll("#xend-ext-dashboard-profile-articles .xend-ext-dashboard-row").length;

            // @ts-ignore
            let message = await getNextArticlesPage({
                task: "getNextArticlesPage",
                uid: state.user.uid,
                token: state.token,
                secret: state.secret,
                start: numOfArticles,
                range: state.user.pageSize
            });

            if (message.result === "setNextArticlesPage") {
                console.log("setNextArticlesPage", message);
                if (message.articles.length == 0) {
                    state.loadingArticles = false;
                    return;
                }
                if (state.user.articleCount == state.user.articles.length) {
                    state.loadingArticles = false;
                    return;
                }
                // @ts-ignore
                message.articles.forEach(article => {
                    // @ts-ignore
                    state.user.articles.push(article);
                });
        
                updateProfilePage();
                // @ts-ignore
                document.querySelector("#xend-ext-dashboard-profile-articles").scrollTop = scrollTop;
                state.loadingArticles = false;

                // @ts-ignore
                chrome.storage.local.set({ state });
            }
        }
    });
}

function createProfileMenu(node: any) {
    console.log("createProfileMenu");
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
    const para = document.querySelector("body");
    // @ts-ignore
    const compStyles = window.getComputedStyle(para);
    const darkModeStyle = compStyles.backgroundColor == 'rgb(255, 255, 255)' ? false : true;

    node.style.height = '280px';
    node.style.position = "relative";
    if (!state.authorized || !state.walletConnected || !state.signedUp) {
        node.style.display = 'none';
    }
    node.getElementsByTagName('aside')[0].setAttribute('xend', 'profile');
    if (node.getElementsByTagName('span')[0]) {
        node.getElementsByTagName('span')[0].remove();
    }
    if (node.getElementsByTagName('h2')[0]) {
        node.getElementsByTagName('h2')[0].remove();
    }

    const container = document.createElement('div');
    container.style.opacity = "0";
    container.style.transition = "opacity .3s";
    container.classList.add("xend-ext-container");
    
    if (darkMode.matches || darkModeStyle) {
        container.classList.add("xend-ext-dark");
    } else {
        container.classList.add("xend-ext-white");
        // @ts-ignore
        document.querySelector(':root').style.setProperty('--xendwhite', '#333333');
    }

    const pageTpl = `
    <div class="xend-ext-menu-header">
        <div class="xend-ext-menu-header-userinfo">
            <img id="xend-ext-menu-avatar" class="xend-ext-dashboard-keys-logo" src="${state.profile.keyAvatar}" alt="avatar" draggable="false" />
            <div id="xend-ext-menu-user" class="xend-ext-menu-user">@${state.profile.keyOwnerName}</div>
        </div>
        <div id="xend-ext-menu-value">
            <div id="xend-ext-menu-ethprice">0</div>
            <div id="xend-ext-menu-usdprice">$0</div>
        </div>
    </div>
    <div class="xend-ext-menu-content">
        <div class="xend-ext-menu-left-col">
            <div class="xend-ext-menu-left-row">
            Owned
            <div id="xend-ext-menu-sharesbalance">0</div>
            </div>
            <div class="xend-ext-menu-left-row">
            Holders
            <div id="xend-ext-menu-holdernum">0</div>
            </div>
            <div class="xend-ext-menu-left-row">
            Keys
            <div id="xend-ext-menu-sharessupply">0</div>
            </div>
            <div id="xend-ext-menu-up-trend-wrapper" class="xend-ext-menu-left-row">
            24h
            <div id="xend-ext-menu-up-trend" class="xend-ext-menu-up-trend-long">0%</div>
            </div>
        </div>
        <div class="xend-ext-menu-right-col">
            <div class="xend-ext-menu-switch">
                <div id="xend-ext-menu-switch-title">Keys</div>
                <button id="xend-ext-menu-friendtech" class="xend-ext-menu-switch-platform"></button>
                <button id="xend-ext-menu-xend" class="xend-ext-menu-switch-platform"></button>
            </div>
            <div class="xend-ext-menu-key">
                <div class="xend-ext-menu-key-value">
                    <input type="number" value="0" id="xend-ext-menu-key-input" />
                    <div id="xend-ext-menu-key-price">0</div>
                </div>
                <button id="xend-ext-menu-key-buy" class="spinner-button">
                    <span class="spinner-button-text">Buy</span>
                </button>
                <button id="xend-ext-menu-key-sell" class="spinner-button">
                    <span class="spinner-button-text">Sell</span>
                </button>
            </div>
            Premium Content
            <div id="xend-ext-menu-premium" class="xend-ext-menu-premium">
                Hold <em>1 keys</em> or <em>subscribe</em> to unlock. Friend.tech supported.
            </div>
            <button id="xend-ext-menu-premium-btn" class="spinner-button">
                <span id="xend-ext-menu-premium-btn-text" class="spinner-button-text">1 Month • 1 ETH</span>
            </button>
        </div>
    </div>
    <div id="buySellModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <div class="modal-icon"></div>
                <p id="buySellModalHeaderTxt" class="modal-header-text">Wrong wallet</p>
            </div>
            <p id="buySellModalMainTxt" class="modal-main-text">
                Connect your paired XEND wallet, 0x1041...3234 to continue.
            </p>
            <button id="buySellModalCloseBtn" class="modal-close-button">Close</button>
        </div>
    </div>
    `;
    container.innerHTML = pageTpl;

    const aside = node.getElementsByTagName('aside')[0];
    aside.replaceChildren(aside.children[0]);
    aside.getElementsByTagName('div')[0].appendChild(container);

    // @ts-ignore
    container.querySelector("#buySellModal").style.display = "none";

    // @ts-ignore
    container.querySelector("#buySellModalCloseBtn")?.addEventListener("click", (e) => {
        // @ts-ignore
        container.querySelector("#buySellModal").style.display = "none";
    })
    // @ts-ignore
    container.querySelector("#xend-ext-menu-friendtech").addEventListener("click", (e) => {
        updateBuySellPageFriendTech();
    });

    // @ts-ignore
    container.querySelector("#xend-ext-menu-xend").addEventListener("click", async (e) => {
        // @ts-ignore
        container.querySelector("#xend-ext-menu-up-trend-wrapper").style.display = "";
        
        let path = window.location.href;
        const prefix = "https://twitter.com/";
        path = path.slice(path.indexOf(prefix) + prefix.length, path.length);
        
        let message = await getKeyInfo({
            task: "getKeyInfo",
            keyOwnerName: path,
            token: state.token,
            secret: state.secret,
            uid: state.user.uid
        });

        if (message.result === "successGetKeyInfo") {
            console.log("successGetKeyInfo", message.data);
            if (message.data.result == "error") {
                // @ts-ignore
                document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "";
            } else {
                state.profile.holderNum = message.data.data.holderNum;
                state.profile.keyBalance = message.data.data.keyBalance;
                state.profile.priceInETH = message.data.data.priceInETH;
                state.profile.changeRate = message.data.data.changeRate;
                state.profile.myKeyBalance = message.data.data.myKeyBalance;
                state.profile.keyId = message.data.data.keyId;
                state.profile.keyOwnerName = message.data.data.keyOwnerName;
                state.profile.keyAvatar = message.data.data.keyAvatar;
                state.profile.keyAddress = message.data.data.keyAddress;
                state.profile.isSubscribed = message.data.data.isSubscribed;
                
                isPendingBuy = false;
                isPendingSell = false;

                // @ts-ignore
                chrome.storage.local.set({ state });

                updateBuySellPageXend();
            }
        }
    });
};

function createSettings(node: any) {
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
    const para = document.querySelector("body");
    // @ts-ignore
    const compStyles = window.getComputedStyle(para);
    const darkModeStyle = compStyles.backgroundColor == 'rgb(255, 255, 255)' ? false : true;

    node.style.height = '425px';
    node.style.position = "relative";
    node.style.display = "none";
    node.getElementsByTagName('aside')[0].setAttribute('xend', 'settings');
    if (node.getElementsByTagName('span')[0]) {
        node.getElementsByTagName('span')[0].remove();
    }
    if (node.getElementsByTagName('h2')[0]) {
        node.getElementsByTagName('h2')[0].remove();
    }

    const container = document.createElement('div');
    container.style.opacity = "0";
    container.style.transition = "opacity .3s";
    container.classList.add("xend-ext-container");
    if (darkMode.matches || darkModeStyle) {
        container.classList.add("xend-ext-dark");
    } else {
        container.classList.add("xend-ext-white");
        // @ts-ignore
        document.querySelector(':root').style.setProperty('--xendwhite', '#333333');
    }

    const pageTpl = `
        <div class="xend-ext-settings-header">
            <div class="xend-ext-settings-top"><button id="xend-ext-settings-close"></button> Settings</div>
            <div class="xend-ext-settings-subtitle">
                <img id="xend-ext-settings-avatar" class="xend-ext-settings-logo" src="${state.user.avatar}" alt="avatar" draggable="false" />
                <div id="xend-ext-settings-user" class="xend-ext-settings-user">${state.user.name}<div id="copyAddress" data-address=${state.user.address} title="Copy">${getShortHash(state.user.address)}</div></div>
                <button id="xend-ext-logout">Logout</button>
            </div>
        </div>
        <div id="xendExtSettingsList" class="xend-ext-settings-content">
            <div id="xendExtSettingsSubscriptions" class="xend-ext-settings-row">
            <div class="xend-ext-settings-column-left"> 
                <div class="xend-ext-settings-title">Subscriptions</div>
                Allow users to unlock your content for a monthly fee.
            </div><div id="xendExtSettingsPrice" class="xend-ext-settings-column-right">${state.user.subscribePriceInETH} ETH</div>
            <div style="clear: both"></div>
            </div>
            <div id="xendExtSettingsFriend" class="xend-ext-settings-row">
            <div class="xend-ext-settings-column-left"> 
                <div class="xend-ext-settings-title">Friend.Tech compatibility</div>
                Allow Friend.Tech keyholders to view your content. Minimum keys amount from content lock applies.
            </div><input id="xendExtFriendTechCheckbox" type="checkbox" checked /><label for="xendExtFriendTechCheckbox"></label>
            <div style="clear: both"></div>
            </div>
        </div>
        <div id="xendExtLogoutWrapper">
            <button id="xend-ext-logout-bottom">Logout</button>
        </div>
        <div id="xendExtSubscriptionDetail" style="display: none">
            <div id="xendExtSubscriptionDetailBack">Back</div>
            <div class="xend-ext-subscription-title">Subscriptions</div>
            <div class="xend-ext-subscription-detail">Allow users to unlock your content for a monthly fee.<div>
            </div>
            <div class="xend-ext-subscription-row">
                <div class="xend-ext-subscription-column-left">
                    <div class="xend-ext-settings-subscription-form">
                        <input type="number" id="xendExtSubscriptionPrice" value=${state.user.subscribePriceInETH} />
                    </div>
                </div>
                <div class="xend-ext-subscription-column-right">
                    <input id="xendExtSubscriptionCheckbox" type="checkbox" /><label for="xendExtSubscriptionCheckbox"></label>
                </div>
            </div>
            <div class="xend-ext-subscription-apply">
                <button id="xendExtSubscriptionUpdate" class="spinner-button">
                    <span class="spinner-button-text">Apply</span>
                </button>
            </div>
        </div>
        <div id="settingModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <div class="modal-icon"></div>
                    <p id="settingModalHeaderTxt" class="modal-header-text">Wrong setting</p>
                </div>
                <p id="settingModalMainTxt" class="modal-main-text">
                    Connect your paired XEND setting, 0x1041...3234 to continue.
                </p>
                <button id="settingModalCloseBtn" class="modal-close-button">Close</button>
            </div>
        </div>
    `;
    container.innerHTML = pageTpl;

    const aside = node.getElementsByTagName('aside')[0];
    aside.replaceChildren(aside.children[0]);
    aside.getElementsByTagName('div')[0].appendChild(container);

    // @ts-ignore
    container.querySelector("#settingModal").style.display = "none";
    // @ts-ignore
    container.querySelector("#settingModalCloseBtn").addEventListener("click", (e) => {
        // @ts-ignore
        container.querySelector("#settingModal").style.display = "none";
    });
    // @ts-ignore
    container.querySelector("#xend-ext-logout").style.display = "none";
    // @ts-ignore
    container.querySelector("#xendExtLogoutWrapper").style.display = "";
    // @ts-ignore
    container.querySelector("#xendExtSettingsSubscriptions").addEventListener("click", e => {
            // @ts-ignore
            container.querySelector("#xendExtLogoutWrapper").style.display = "none";
            // @ts-ignore
            container.querySelector("#xend-ext-logout").style.display = "";
            // @ts-ignore
            container.querySelector("#xendExtSettingsList").style.display = "none";
            // @ts-ignore
            container.querySelector("#xendExtSubscriptionDetail").style.display = "block";
            // @ts-ignore
            container.querySelector(".xend-ext-settings-detail-right").style.visibility = "visible";
            // @ts-ignore
            container.querySelector(".xend-ext-settings-subscription-form").style.visibility = "visible";
    });
    // @ts-ignore
    container.querySelector("#xendExtFriendTechCheckbox").addEventListener("change", async (e: any) => {
        // @ts-ignore
        let msg = await setFriendTechCompatibility({
            task: "setFriendTechCompatibility",
            isCompatible: e.target.checked,
            uid: state.user.uid,
            token: state.token,
            secret: state.secret
        });
        // @ts-ignore
        if (msg.result === "successSetCompatibility") {
            if (msg.status) {
                state.user.isCompatibility = e.target.checked;

                // @ts-ignore
                chrome.storage.local.set({ state });
                alert("success");
            }
        }
    });
    // @ts-ignore
    container.querySelector("#xendExtSubscriptionUpdate").addEventListener("click", async (e) => {
        isPendingUpdatePrice = true;
        // @ts-ignore
        document.getElementById("xendExtSubscriptionUpdate").classList.add("spinner-button-loading");
        // @ts-ignore
        document.getElementById("xendExtSubscriptionUpdate").disabled = true;

        // @ts-ignore
        let price = document.getElementById("xendExtSubscriptionPrice").value;
        console.log(typeof price, price);
        if (price <= 0 || price > 100) {
            isPendingUpdatePrice = false;
            // @ts-ignore
            document.getElementById("xendExtSubscriptionUpdate").classList.remove("spinner-button-loading");
            // @ts-ignore
            document.getElementById("xendExtSubscriptionUpdate").disabled = false;
            showSettingModal("Alert", "Please input positive value less than 100ETH.");
            return;
        }

        price = Web3.utils.toWei(price, "ether");
        const provider = new ethers.providers.Web3Provider(getProvider());

        signer = provider.getSigner();
        subscribeContract = new ethers.Contract(subscribeAddress, subscribeABI, provider);
        
        if (state.user.isSubscriptionEnabled) {
            try {
                const result = await subscribeContract.connect(signer)["editMonthlySubPrice"](price);
                if (!result.hash) {
                    isPendingUpdatePrice = false;
                    // @ts-ignore
                    document.getElementById("xendExtSubscriptionUpdate").classList.remove("spinner-button-loading");
                    // @ts-ignore
                    document.getElementById("xendExtSubscriptionUpdate").disabled = false;
                    showSettingModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
                    return;
                }
                // @ts-ignore
                result.wait().then(res => {
                    isPendingUpdatePrice = false;
                    // @ts-ignore
                    document.getElementById("xendExtSubscriptionUpdate").classList.remove("spinner-button-loading");
                    // @ts-ignore
                    document.getElementById("xendExtSubscriptionUpdate").disabled = false;
                    if (res.status) {
                        return;
                    } else {
                        showSettingModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
                    }
                });
            } catch (error) {
                console.log("SubscriptionPrice: ", error);
                isPendingUpdatePrice = false;
                // @ts-ignore
                document.getElementById("xendExtSubscriptionUpdate").classList.remove("spinner-button-loading");
                // @ts-ignore
                document.getElementById("xendExtSubscriptionUpdate").disabled = false;
                showSettingModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
            }
        } else {
            // @ts-ignore
            const isChecked = document.getElementById("xendExtSubscriptionCheckbox").checked;
            if (!isChecked) {
                isPendingUpdatePrice = false;
                // @ts-ignore
                document.getElementById("xendExtSubscriptionUpdate").classList.remove("spinner-button-loading");
                // @ts-ignore
                document.getElementById("xendExtSubscriptionUpdate").disabled = false;
                return;
            }
            try {
                const result = await subscribeContract.connect(signer)["enableMonthlySubscriptions"](price);
                if (!result.hash) {
                    isPendingUpdatePrice = false;
                    // @ts-ignore
                    document.getElementById("xendExtSubscriptionUpdate").classList.remove("spinner-button-loading");
                    // @ts-ignore
                    document.getElementById("xendExtSubscriptionUpdate").disabled = false;
                    showSettingModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
                    return;
                }
                // @ts-ignore
                result.wait().then(res => {
                    isPendingUpdatePrice = false;
                    // @ts-ignore
                    document.getElementById("xendExtSubscriptionUpdate").classList.remove("spinner-button-loading");
                    // @ts-ignore
                    document.getElementById("xendExtSubscriptionUpdate").disabled = false;
                    // @ts-ignore
                    document.getElementById("xendExtSubscriptionCheckbox").disabled = true;                    
                    if (res.status) {
                        
                    } else {
                        showSettingModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
                    }
                });
            } catch (error) {
                console.log("SubscriptionPrice: ", error);
                isPendingUpdatePrice = false;
                // @ts-ignore
                document.getElementById("xendExtSubscriptionUpdate").classList.remove("spinner-button-loading");
                // @ts-ignore
                document.getElementById("xendExtSubscriptionUpdate").disabled = false;
                showSettingModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
            }
        }
    });
    // @ts-ignore
    container.querySelector("#xendExtSubscriptionDetailBack").addEventListener("click", e => {
        // @ts-ignore
        container.querySelector("#xendExtSubscriptionDetail").style.display = "none";
        // @ts-ignore
        container.querySelector("#xendExtSettingsList").style.display = "block";
        // @ts-ignore
        container.querySelector("#xend-ext-logout").style.display = "none";
        // @ts-ignore
        container.querySelector("#xendExtLogoutWrapper").style.display = "";
    }, false);

    // @ts-ignore
    container.querySelector("#xend-ext-settings-close").addEventListener("click", e => {
        // @ts-ignore
        document.querySelector('aside[xend="settings"]').parentNode.parentNode.style.display = "none";
        // @ts-ignore
        document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "";
    });

    // @ts-ignore
    container.querySelector("#xend-ext-logout").addEventListener("click", e => {
        logout();
    }, false);

    // @ts-ignore
    container.querySelector("#xend-ext-logout-bottom").addEventListener("click", e => {
        logout();
    }, false);

    // @ts-ignore
    container.querySelector("#copyAddress").addEventListener("click", e => {
        // @ts-ignore
        navigator.clipboard.writeText(e.target.dataset.address);
    }, false);
}

async function checkURL(isStart: boolean) {
    if (isStart) {
        // @ts-ignore
        document.querySelector('aside[xend="settings"]').parentNode.parentNode.style.display = "none";
        // @ts-ignore
        document.querySelector('aside[xend="profile"]').parentNode.parentNode.style.display = "none";
        // @ts-ignore
        document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "none";
    }

    await updateFeedPage();
    
    let path = window.location.href;
    const prefix = "https://twitter.com/";
    path = path.slice(path.indexOf(prefix) + prefix.length, path.length);
    
    let msg = await getKeyInfo({
        task: "getKeyInfo",
        keyOwnerName: path,
        token: state.token,
        secret: state.secret,
        uid: state.user.uid
    });

    if (msg.result === "successGetKeyInfo") {
        if (msg.data.result == "error") {
            // @ts-ignore
            document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "";
        } else {
            state.profile.holderNum = msg.data.data.holderNum;
            state.profile.keyBalance = msg.data.data.keyBalance;
            state.profile.priceInETH = msg.data.data.priceInETH;
            state.profile.changeRate = msg.data.data.changeRate;
            state.profile.myKeyBalance = msg.data.data.myKeyBalance;
            state.profile.keyId = msg.data.data.keyId;
            state.profile.keyOwnerName = msg.data.data.keyOwnerName;
            state.profile.keyAvatar = msg.data.data.keyAvatar;
            state.profile.keyAddress = msg.data.data.keyAddress;
            state.profile.isSubscribed = msg.data.data.isSubscribed;
            
            // @ts-ignore
            chrome.storage.local.set({ state });

            await updateBuySellPageXend();

            if (state.walletConnected && state.authorized && state.signedUp) {
                // @ts-ignore
                document.querySelector('aside[xend="profile"]').parentNode.parentNode.style.display = "";
                // @ts-ignore
                document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "";
            }
        }
    }
}

//////////////////////////////////////////////////////////////////  Main Loop
async function onMutation(mutations: MutationRecord[]) {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            const nodes = traverseAndFindAttribute(node, 'aside');
            // @ts-ignore
            nodes.forEach((n: any) => {
                const sidebar = n.parentElement.parentElement.parentElement;

                getState(async () => {
                    // When Page is refreshed, Load State, and Init UI
                    if (!document.getElementById("xendExtStyleList")) {
                        injectStyleList();
                    }

                    const provider = new ethers.providers.Web3Provider(getProvider());

                    signer = provider.getSigner();
                    subscribeContract = new ethers.Contract(subscribeAddress, subscribeABI, provider);
                    xendContract = new ethers.Contract(address, abi, provider);

                    // Login
                    const loginMenu = n.parentElement.parentElement.cloneNode(true);
                    createLogin(loginMenu);
                    sidebar.insertBefore(loginMenu, sidebar.children[2]);

                    // Wallet
                    const walletMenu = n.parentElement.parentElement.cloneNode(true);
                    createWalletConnect(walletMenu);
                    sidebar.insertBefore(walletMenu, sidebar.children[2]);

                    // SignUp
                    const signUpMenu = n.parentElement.parentElement.cloneNode(true);
                    createSignUp(signUpMenu);
                    sidebar.insertBefore(signUpMenu, sidebar.children[2]);

                    // Dashboard
                    const dashboardMenu = n.parentElement.parentElement.cloneNode(true);
                    createDashboard(dashboardMenu);
                    sidebar.insertBefore(dashboardMenu, sidebar.children[2]);

                    // Settings
                    const settingsMenu = n.parentElement.parentElement.cloneNode(true);
                    createSettings(settingsMenu);
                    sidebar.insertBefore(settingsMenu, sidebar.children[2]);

                    // Profile
                    const profileMenu = n.parentElement.parentElement.cloneNode(true);
                    createProfileMenu(profileMenu);
                    sidebar.insertBefore(profileMenu, sidebar.children[2]);

                    checkURL(true);
                });
            });
        }
    }
};

const mo = new MutationObserver(onMutation);

function observe() {
    mo.observe(document, {
        subtree: true,
        childList: true,
    });
};

observe();

const mo2 = new MutationObserver(async (mutations) => {
    // Change Color Mode according to System Settings
    for (const mutation of mutations) {
        if (mutation.attributeName === "style") {
            setThemeColors();
        }
    }
});

function observe2() {
    mo2.observe(document.body, {
        attributes: true,
        subtree: false,
        childList: false,
    });
};

observe2();
//////////////////////////////////////////////////////////////////  
walletProvider = getProvider();

// @ts-ignore
walletProvider.on('accountsChanged', async function (accounts) {
    // Time to reload your interface with accounts[0]!
    if (accounts[0] == null) {
        logout();
    }
})

// @ts-ignore
walletProvider.on('connect', async function (connectInfo) {
    // Time to reload your interface with the new networkId
    let chainId = parseInt(connectInfo.chainId, 16);
    console.log(chainId);
    if (chainId != chain) {
        let res = await switchChainToETH(walletProvider);
        if (!res) {
            logout();
        }
    }
})