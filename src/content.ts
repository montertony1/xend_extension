import { AnyNaptrRecord } from 'dns';
import Web3 from 'web3';
import { ethers } from "ethers";
import { MetaMaskInpageProvider } from '@metamask/inpage-provider';
import PortDuplexStream from 'extension-port-stream';
import { abi, address, chain } from "./config";

// @ts-ignore
import { detect } from 'detect-browser';
import { createSign } from 'crypto';
const browser = detect();

const logoW = chrome.runtime.getURL("/static/img/xend-small-white.png");
const logoB = chrome.runtime.getURL("/static/img/xend-small-black.png");
const avatarImg = chrome.runtime.getURL("/static/img/avatar.png");
const avatarImg2 = chrome.runtime.getURL("/static/img/avatar2.png");
const styleList = chrome.runtime.getURL("/static/css/style.css");

var port = chrome.runtime.connect({name: "authorize"});

let state = {
    signedUp: false,
    authorized: false,
    walletConnected: false,
    token: null,
    secret: null,
    file: null,
    loadingArticles: false,
    user: {
        address: "",
        uid: "",
        avatar: avatarImg,
        name: "@elonmusk",
        articleCount: 0,
        currentRange: 0,
        pageSize: 2,
        articles: [{
            postID: "3333333333",
            uid: "1714271034139127809",
            imageUrl: "https://pbs.twimg.com/profile_images/1715151701911420928/OrdjW-eg_400x400.jpg",
            message: "Buy $elondoge now ca: 0xe28b3B32B6c345A34Ff64674606124Dd5Aceca30",
            timestamp: 1698255874291,
            comments: [{
                postID: "11111111111",
                author: "@BillGates",
                authorUID: "23452345",
                message: "Aped"
            }, {
                author: "@Zuck",
                message: "Thanks for the financical advice"
            }]
        }]
    },
    feed: [{
        postID: "1111111111",
        author: "@elonmusk",
        uid: "1714271034139127809",
        imageUrl: "https://pbs.twimg.com/profile_images/1715151701911420928/OrdjW-eg_400x400.jpg",
        message: "Sold 500k doge to buy 420 @tesla keys",
        timestamp: 1698255874291,
        comments: [{
            author: "@BillGates",
            message: "Aped"
        }, {
            author: "@Zuck",
            message: "Thanks for the financical advice"
        }, {
            author: "@Zuck",
            message: "I lost 50K"
        }]
    }, {
        postID: "2222222222",
        author: "@LewisHamilton",
        uid: "1714271034139127809",
        imageUrl: "https://pbs.twimg.com/profile_images/1715151701911420928/OrdjW-eg_400x400.jpg",
        message: "Crashing on lap 50, place your bets",
        timestamp: 1698255874291,
        comments: []
    }],
    keysPageInfo: {
        currentRange: 0,
        pageSize: 5
    },
    key: {
        keyBalance: 123,
        holderNum: 95,
        priceInETH: 0.0012,
        totalPrice: 22.062
    },
    keys: [{
        uid: "123412341234",
        avatar: "https://pbs.twimg.com/profile_images/1715151701911420928/OrdjW-eg_400x400.jpg",
        name: "elonmusk",
        price: "0.0012",
        balance: "50"
    },
    {
        uid: "123412341234",
        avatar: "https://pbs.twimg.com/profile_images/1715151701911420928/OrdjW-eg_400x400.jpg",
        name: "elonmusk",
        price: "0.0012",
        balance: "50"
    },
    {
        uid: "123412341234",
        avatar: "https://pbs.twimg.com/profile_images/1715151701911420928/OrdjW-eg_400x400.jpg",
        name: "elonmusk",
        price: "0.0012",
        balance: "50"
    },
    {
        uid: "123412341234",
        avatar: "https://pbs.twimg.com/profile_images/1715151701911420928/OrdjW-eg_400x400.jpg",
        name: "elonmusk",
        price: "0.0012",
        balance: "50"
    },
    {
        uid: "123412341234",
        avatar: "https://pbs.twimg.com/profile_images/1715151701911420928/OrdjW-eg_400x400.jpg",
        name: "elonmusk",
        price: "0.0012",
        balance: "50"
    }]
};

let web3: any = null;
let walletProvider: any = null;
let chainID: any = null;
let contract: any = null;
let currentWalletAddress: string = "";

const user = {
    pfp: 'https://pbs.twimg.com/profile_images/1606815745215791105/IX8pacjk_400x400.jpg'
}

const validateMetamaskAddress = (address: string) => {
    console.log("validateMetamaskAddress", address);
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

const getNormalizeAddress = (accounts: any) => {
    return accounts[0] ? accounts[0].toLowerCase() : null
}

const config = {
    "CHROME_ID": "nkbihfbeogaeaoehlefnkodbefgpgknn",
    "FIREFOX_ID": "webextension@metamask.io"
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

const getInPageProvider = () => {
    let provider
  try {
    let currentMetaMaskId = getMetaMaskId();
    const metamaskPort = chrome.runtime.connect(currentMetaMaskId);
    console.log("PortDuplexStream", PortDuplexStream);
    const pluginStream = new PortDuplexStream(metamaskPort);
    provider = new MetaMaskInpageProvider(pluginStream);
 } catch (e) {
    console.dir(`Metamask connect error `, e)
    throw e
  }
  return provider
}

const getProvider = () => {
    // @ts-ignore
    console.log("getProvider", window.ethereum);
        // @ts-ignore
    if (window.ethereum) {
        console.log('found window.ethereum>>');
        // @ts-ignore
        return window.ethereum;
    } else {
        console.log("getInPageProvider");
        const provider = getInPageProvider();
        return provider;
    }
}

const getAccounts = async (provider: AnyNaptrRecord) => {
    console.log("getAccounts");

    if (provider) {
        const [accounts, chainId] = await Promise.all([
            // @ts-ignore
            provider.request({
                method: 'eth_requestAccounts',
            }),
            // @ts-ignore
            provider.request({ method: 'eth_chainId' }),
        ]);
        if (chain != chainId) {
            try {
                // @ts-ignore
                const res = await provider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: `0x${chain.toString(16)}` }],
                });
                console.log("success1: ", res);
            } catch (error) {
                console.log("request1: ", error);
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
                        console.log("success2: ", res);
                    } catch (error) {
                        console.error("request2: ", error);
                    }
                  } else {
                    console.error("request3: ", error);
                  }
            }
        }
        return [accounts, chain];
    }
    return false;
}

const connectWalletFunc = async () => {
    console.log("connectWallet runs....")
    try {
        const provider = getProvider();
        walletProvider = provider;
        //@ts-ignore
        const [accounts, chainId] = await getAccounts(provider);
        if (accounts && chainId) {
            const account = getNormalizeAddress(accounts);
            
            web3 = new Web3(provider);

            // @ts-ignore
            contract = new web3.eth.Contract(abi, address);
            chainID = chainId;

            return {
                result: true,
                address: account
            };
        }
    } catch (e) {
        console.log("error while connect", e);
    }
    return {
        result: false
    };
}

const getShortHash = (hash: string) => {
    if (hash.length < 20) {
        return hash;
    }
    return hash.slice(0, 6) + " ... " + hash.slice(hash.length - 4, hash.length);
}

const traverseAndFindAttribute = (node: any, tagName: string): any => {
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
        const xendSend = document.querySelector('[xend="send"]')
        if (xendSend) {
            const author = JSON.parse(node.innerHTML).author;
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


function getState(callback: any) {
    chrome.storage.local.get(["state"], (opt) => {
        if (opt && opt.state) {
            state = opt.state;
        }
        callback();
    });
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

function login() {
    console.log("login");
    // @ts-ignore
    if (state.authorized && document.querySelector('aside[xend="wallet"]') && document.querySelector('aside[xend="wallet"]').parentNode.parentNode.style.display == "none") {
        // @ts-ignore
        document.querySelector('aside[xend="login"]').parentNode.parentNode.style.display = "none";
        // @ts-ignore
        document.querySelector('aside[xend="wallet"]').parentNode.parentNode.style.display = "";
        return;
    }
    
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

            chrome.storage.local.set({
                state: state
            });

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

async function connectWallet() {
    console.log("connectWallet");

    const res = await connectWalletFunc();
    if (!res.result) {
        return;
    }
    state.walletConnected = true;
    chrome.storage.local.set({
        state: state
    });

    currentWalletAddress = res.address;
    if (state.authorized && state.walletConnected && state.signedUp) {
        if (
            document.querySelector('aside[xend="dashboard"]')
            // @ts-ignore
            && document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display == "none"
        ) {
            // @ts-ignore
            document.querySelector('aside[xend="wallet"]').parentNode.parentNode.style.display = "none";
            // @ts-ignore
            document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "";
        }
    } else {
        const provider = new ethers.providers.Web3Provider(walletProvider);
        const signer = provider.getSigner();
        const xendContract = new ethers.Contract(address, abi, provider);
    
        try {
            console.log("getCreatorSignUpStatus: ", currentWalletAddress);
            const result = await xendContract.connect(signer)["getCreatorSignUpStatus"](currentWalletAddress);
            console.log(result);
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
                chrome.storage.local.set({
                    state: state
                });
                // @ts-ignore
                document.querySelector('aside[xend="wallet"]').parentNode.parentNode.style.display = "none";
                // @ts-ignore
                document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "";
            }
        } catch (error: any) {
            console.log("getCreatorSignUpStatus", error);
            return;
        }
    }
}


async function successSignup() {
    port.postMessage({
        task: "setWalletAddr",
        address: currentWalletAddress,
        uid: state.user.uid
    });
    port.onMessage.addListener(function(msg: any) {
        if (msg.result === "statusWalletSet") {
            console.log("statusWalletSet: ", msg.result);
            if (msg.result) {
                state.user.address = currentWalletAddress;
                state.signedUp = true;

                chrome.storage.local.set({
                    state: state
            
                });
            
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
            }
        }
    });
}
// 
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
    console.log("referrer", referrer, chainID);

    const provider = new ethers.providers.Web3Provider(walletProvider);
    const signer = provider.getSigner();
    const xendContract = new ethers.Contract(address, abi, provider);
    
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
                successSignup();
            });
        } catch (error: any) {
            console.log("signUpError", error.error);
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
                successSignup();
            });
        } catch (error: any) {
            console.log("signUpError", error.error);
            return;
        }
    }   
}

function logout() {
    state.authorized = false;
    state.walletConnected = false;
    state.signedUp = true;
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

    chrome.storage.local.set({
        state: state
    });
    if (!state.authorized && !state.walletConnected
        && document.querySelector('aside[xend="dashboard"]')
        && document.querySelector('aside[xend="profile"]')
        && document.querySelector('aside[xend="settings"]')
        // @ts-ignore
        && (document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display == ""
            // @ts-ignore
            || document.querySelector('aside[xend="settings"]').parentNode.parentNode.style.display == "")
    ) {
        // @ts-ignore
        document.querySelector('aside[xend="settings"]').parentNode.parentNode.style.display = "none";
        // @ts-ignore
        document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "none";
        // @ts-ignore
        document.querySelector('aside[xend="profile"]').parentNode.parentNode.style.display = "none";
        // @ts-ignore
        document.querySelector('aside[xend="login"]').parentNode.parentNode.style.display = "";
    }
}

function createCommentsForm(container: any, postID: any, comments: any) {
    let items: string[] = [];
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

function getFeed(container: any) {
    let items: string[] = [];

    // @ts-ignore
    state.feed.forEach(row => {
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
                <img class="xend-ext-dashboard-news-logo" src="${row.imageUrl}" alt="avatar" draggable="false" />
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
          ` + createCommentsForm(container, row.postID, row.comments) + `
        </div>
        `);
    });
    return items.join("");
}


const getPrice = (price: any) => {
    let nPrice = price * 1;
    return nPrice.toFixed(4);
}

const getTotalPrice = (price: any, balance: any) => {
    let nPrice = price * 1;
    let nBalance = balance * 1;
    return (nPrice * nBalance).toFixed(4);
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
    
  content += '</div>';

  return content;
}

function getArticles(container: any, articles: { uid: string; comments: ({ author: string; authorUID: string; postID: string; message: string } | { author: string; message: string })[]; imageUrl: string; postID: string; message: string; timestamp: number }[]) {
    let items: string[] = [];

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

function createLogin(node: any) {
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
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
    const para = document.querySelector("body");
    // @ts-ignore
    const compStyles = window.getComputedStyle(para);
    const darkModeStyle = compStyles.backgroundColor == 'rgb(255, 255, 255)' ? false : true;

    node.style.height = '280px';
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

    console.log("wallet connect", state.user.avatar, state.user.name);

    const pageTpl = `
    <img id="xend-ext-wallet-avatar" class="xend-ext-wallet-avatar" src="${state.user.avatar}" alt="avatar" draggable="false" />
    <div id="xend-ext-wallet-user" class="xend-ext-wallet-user">${state.user.name}</div>
    <button id="xend-ext-wallet-connect-btn"></button>
    `;
    container.innerHTML = pageTpl;

    const aside = node.getElementsByTagName('aside')[0];
    aside.replaceChildren(aside.children[0]);
    aside.getElementsByTagName('div')[0].appendChild(container);

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
        <button id="xend-ext-dashboard-settings-btn" title="Settings"><img id="xend-ext-dashboard-setting-avatar" src="${state.user.avatar}" alt="" draggable="false" /></button>
    </div>
    
<div class="tabs">
  <div id="content-1" class="selected">
    ` + getFeed(container) + `
  </div>

  <div id="content-2">
  ` + getKeys(container, { ...state.key, keys: state.keys }) + `<div id="xend-ext-keys-loader">&nbsp;</div>  
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
    container.querySelector('a[href="#content-1"]').addEventListener("click", (e) => {
        console.log("Show Feed Page");
        e.preventDefault();
        // @ts-ignore
        container.querySelector('#content-1').classList.add("selected");
        // @ts-ignore
        container.querySelector('#content-2').classList.remove("selected");
        // @ts-ignore
        container.querySelector('#content-3').classList.remove("selected");
        // @ts-ignore
        container.querySelector('#content-4').classList.remove("selected");
    });
    // @ts-ignore
    container.querySelector('a[href="#content-2"]').addEventListener("click", (e) => {
        e.preventDefault();

        console.log("Show Keys Page");

        port.postMessage({
            task: "getMyKeys",
            uid: state.user.uid,
            token: state.token,
            secret: state.secret,
        });

        port.onMessage.addListener(function(msg) {
            if (msg.result === "successGetMyKeys") {
                state.key.keyBalance = msg.keyBalance;
                state.key.holderNum = msg.holderNum;
                state.key.priceInETH = msg.priceInETH;
                state.key.totalPrice = msg.totalPrice;

                state.keys = msg.myKeys;

                chrome.storage.local.set({
                    state: state
                });

                updateKeysPage();
            }
        });
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
    container.addEventListener("click", e => {
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

            port.postMessage({
                task: "deleteArticle",
                postID: pid,
                uid: uid,
                token: state.token,
                secret: state.secret,
                articlePosterUID: uid,
                start: state.user.currentRange,
                num: state.user.pageSize
            });

            port.onMessage.addListener(function(msg) {
                if (msg.result === "successDeleteArticle") {
                    console.log("successDeleteArticle: ", msg.articles);
                    state.user.articles = msg.articles;
                    state.user.currentRange = msg.start;

                    updateProfilePage();

                    chrome.storage.local.set({
                        state: state
                    });
                }
            });
        }
    });

    const updateKeysPage = () => {
        console.log("updateKeysPage");

        let keys = [];
        let last = state.keys.length > (state.keysPageInfo.pageSize + state.keysPageInfo.currentRange) ? state.keysPageInfo.pageSize : state.keys.length - state.keysPageInfo.currentRange;
        for (let i = 0; i < last; i++) {
            keys.push({
                ...state.keys[state.keysPageInfo.currentRange + i]
            });
        }
        const item = getKeys(container, { avatar: state.user.avatar, ...state.key, keys });

        // @ts-ignore
        document.getElementById("content-2").innerHTML = item
            + `<div id="xend-ext-articles-loader">&nbsp;</div>`;
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
        document.getElementById("xend-ext-dashboard-profile-articles").innerHTML = item
            + `<div id="xend-ext-articles-loader">&nbsp;</div>`;

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
            el.addEventListener("click", e => {
                e.preventDefault();
                // @ts-ignore
                const content = e.target.previousElementSibling.value.trim();
                // @ts-ignore
                const pid = e.target.dataset.pid;
                // @ts-ignore
                port.postMessage({
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
                port.onMessage.addListener(function(msg) {
                    if (msg.result === "successPostComment") {
                        console.log("successPostComment: ", msg.articles);
                        state.user.articles = msg.articles;

                        updateProfilePage();
            
                        chrome.storage.local.set({
                            state: state
                        });
                    }
                });
            });
        });
    }

    // @ts-ignore
    container.querySelector('a[href="#content-3"]').addEventListener("click", (e) => {
        console.log("Show Profile Page");
        e.preventDefault();

        // @ts-ignore
        port.postMessage({
            task: "openProfilePage",
            uid: state.user.uid,
            token: state.token,
            secret: state.secret,
            range: state.user.pageSize
        });

        port.onMessage.addListener(function(msg) {
            if (msg.result === "setArticleCount") {
                console.log("setArticleCount", state);
                // @ts-ignore
                state.user.articleCount = msg.count;
                state.user.currentRange = 0;
                state.user.articles = msg.articles;

                console.log("setArticleCount", msg.count);

                updateProfilePage();
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
    });
    // @ts-ignore
    container.querySelector('a[href="#content-4"]').addEventListener("click", (e) => {
        console.log("Show FT Page");
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
    container.querySelector("#xend-ext-dashboard-settings-btn").addEventListener("click", e => {
        // @ts-ignore
        document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "none";
        // @ts-ignore
        document.querySelector('aside[xend="settings"]').parentNode.parentNode.style.display = "";
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
    container.querySelectorAll(".xend-ext-comment a").forEach(el => {
        el.addEventListener("click", e => {
            e.preventDefault();
            // @ts-ignore
            const content = e.target.previousElementSibling.value.trim();
            // @ts-ignore
            const pid = e.target.dataset.pid;
            // @ts-ignore
            port.postMessage({
                task: "postComment",
                content: content,
                postID: pid,
                token: state.token,
                secret: state.secret,
                articlePosterUID: state.user.uid,
                uid: state.user.uid
            });

        });
    });

    // @ts-ignore
    container.querySelector("#addFile").addEventListener("change", e => {
        // @ts-ignore
        let file = e.target.files[0];

        state.file = file;
        console.log(state.file);

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
    container.querySelector("#xend-ext-dashboard-profile-post").addEventListener("click", e => {
        console.log("Post Article");
        // @ts-ignore
        const content = document.querySelector("#xendExtPostContent").value.trim();
        // @ts-ignore
        if (document.getElementById("addFile").value) {
            // @ts-ignore
            let file = document.getElementById("addFile").files[0];
            const reader = new FileReader();
            reader.onload = async (event) => {
                // @ts-ignore
                port.postMessage({
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
            }
            reader.readAsDataURL(file);
        } else {
            // @ts-ignore
            port.postMessage({
                task: "postArticle",
                image: "",
                content: content,
                uid: state.user.uid,
                token: state.token,
                secret: state.secret,
                type: "",
                range: state.user.pageSize
            });
        }

        port.onMessage.addListener(function(msg) {
            if (msg.result === "successPostArticle") {
                console.log("successPostArticle: ", msg.count, msg.articles);
                state.user.articleCount = msg.count;
                state.user.articles = msg.articles;
                state.user.currentRange = msg.start;

                updateProfilePage();
    
                chrome.storage.local.set({
                    state: state
                });
    
                // @ts-ignore
                if (state.authorized && document.querySelector('aside[xend="wallet"]') && document.querySelector('aside[xend="wallet"]').parentNode.parentNode.style.display == "none") {
                    // @ts-ignore
                    document.querySelector('aside[xend="login"]').parentNode.parentNode.style.display = "none";
                    // @ts-ignore
                    document.querySelector('aside[xend="wallet"]').parentNode.parentNode.style.display = "";
                }
            }
        });
    });


    // @ts-ignore
    container.querySelector("#xend-ext-dashboard-profile-articles").addEventListener("scroll", e => {
        if (!state.loadingArticles && document.querySelector("#xend-ext-articles-loader")
            // @ts-ignore
            && (document.querySelector("#xend-ext-articles-loader").offsetTop <
                // @ts-ignore
                document.querySelector("#xend-ext-articles-loader").parentNode.offsetHeight
                // @ts-ignore
                + document.querySelector("#xend-ext-articles-loader").parentNode.scrollTop)
        ) {
            state.loadingArticles = true;
            // @ts-ignore
            const scrollTop = document.querySelector("#xend-ext-dashboard-profile-articles").scrollTop;
            const numOfArticles = document.querySelectorAll("#xend-ext-dashboard-profile-articles .xend-ext-dashboard-row").length;

            // @ts-ignore
            port.postMessage({
                task: "getNextArticlesPage",
                uid: state.user.uid,
                token: state.token,
                secret: state.secret,
                start: numOfArticles,
                range: state.user.pageSize
            });

            port.onMessage.addListener(function(msg) {
                if (msg.result === "setNextArticlesPage") {
                    console.log("setNextArticlesPage", msg);
                    // @ts-ignore
                    msg.articles.forEach(article => {
                        state.user.articles.push(article);
                    });
                    const item = getArticles(container, msg.articles);
                    // @ts-ignore
                    document.querySelector("#xend-ext-articles-loader").insertAdjacentHTML("beforebegin", item);
                    // @ts-ignore
                    document.querySelector("#xend-ext-dashboard-profile-articles").scrollTop = scrollTop;
                    state.loadingArticles = false;
                    //updateProfilePage();
                }
            });

        }
    });
}

const createProfileMenu = (node: any) => {
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
    const para = document.querySelector("body");
    // @ts-ignore
    const compStyles = window.getComputedStyle(para);
    const darkModeStyle = compStyles.backgroundColor == 'rgb(255, 255, 255)' ? false : true;

    node.style.height = '280px';
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
        <img id="xend-ext-menu-avatar" class="xend-ext-dashboard-keys-logo" src="${state.user.avatar}" alt="avatar" draggable="false" />
        <div id="xend-ext-menu-user" class="xend-ext-menu-user">${state.user.name}</div>
        <div id="xend-ext-menu-value">
        0.441
        <div>$495.4</div>
        </div>
    </div>
    <div class="xend-ext-menu-content">
        <div class="xend-ext-menu-left-col">
            <div class="xend-ext-menu-left-row">
            Owned
            <div>4</div>
            </div>
            <div class="xend-ext-menu-left-row">
            Holders
            <div>3491</div>
            </div>
            <div class="xend-ext-menu-left-row">
            Keys
            <div>7420</div>
            </div>
            <div class="xend-ext-menu-left-row">
            24h
            <div class="xend-ext-menu-up-trend">14%</div>
            </div>
        </div>
        <div class="xend-ext-menu-right-col">
        Keys
        <div class="xend-ext-menu-key">
            <div class="xend-ext-menu-key-value">
                <input type="text" value="10" />
                <div>4.41</div>
            </div>
            <button id="xend-ext-menu-key-buy">
            Buy
            </button>
            <button id="xend-ext-menu-key-sell">
            Sell
            </button>
        </div>
        Premium Content
        <div class="xend-ext-menu-premium">
        Hold <em>5 keys</em> or subscribe to unlock. Friend.tech supported.
        </div>
        <button id="xend-ext-menu-premium-btn">
            1 Month • 0.2 ETH
        </button>
        </div>
    </div>
    
  
    `;
    container.innerHTML = pageTpl;

    const aside = node.getElementsByTagName('aside')[0];
    aside.replaceChildren(aside.children[0]);
    aside.getElementsByTagName('div')[0].appendChild(container);

};

function createSettings(node: any) {
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
    const para = document.querySelector("body");
    // @ts-ignore
    const compStyles = window.getComputedStyle(para);
    const darkModeStyle = compStyles.backgroundColor == 'rgb(255, 255, 255)' ? false : true;

    node.style.height = '425px';
    if (!state.authorized || !state.walletConnected || !state.signedUp) {
        node.style.display = 'none';
    }
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
        <div id="xendExtSettingsContent" class="xend-ext-settings-row">
          <div class="xend-ext-settings-column-left"> 
            <div class="xend-ext-settings-title">Content lock</div>
            Minimum keys required to view your content.
          </div><div class="xend-ext-settings-column-right">2</div>
          <div style="clear: both"></div>
        </div>
        <div id="xendExtSettingsSubscriptions" class="xend-ext-settings-row">
          <div class="xend-ext-settings-column-left"> 
            <div class="xend-ext-settings-title">Subscriptions</div>
            Allow users to unlock your content for a monthly fee.
          </div><div class="xend-ext-settings-column-right">0.4 ETH</div>
          <div style="clear: both"></div>
        </div>
        <div id="xendExtSettingsFriend" class="xend-ext-settings-row">
          <div class="xend-ext-settings-column-left"> 
            <div class="xend-ext-settings-title">Friend.Tech compatibility</div>
            Allow Friend.Tech keyholders to view your content. Minimum keys amount from content lock applies.
          </div><div class="xend-ext-settings-column-right">On</div>
          <div style="clear: both"></div>
        </div>
        <div id="xendExtSettingsDelete" class="xend-ext-settings-row">
          <div class="xend-ext-settings-column-left"> 
            <div class="xend-ext-settings-title">Delete all my data</div>
            Your account will still be tied to the same ETH address.
          </div><div class="xend-ext-settings-column-right">&nbsp;</div>
          <div style="clear: both"></div>
        </div>
    </div>
    <div id="xendExtSettingsDetail" style="display: none">
        <div id="xendExtSettingsDetailBack">Back</div>
        <div class="xend-ext-settings-detail-left">
            <div class="xend-ext-settings-detail-title"></div>
            <div class="xend-ext-settings-detail-form">
                <input type="text" value="0.2" />
            </div>
        </div><div class="xend-ext-settings-detail-right">
        <input id="xendExtSubscriptionCheckbox" type="checkbox" checked /><label for="xendExtSubscriptionCheckbox"></label>
        <button id="xendExtSubscriptionUpdate">Update</button>
        </div>
    </div>
    
  
    `;
    container.innerHTML = pageTpl;

    const aside = node.getElementsByTagName('aside')[0];
    aside.replaceChildren(aside.children[0]);
    aside.getElementsByTagName('div')[0].appendChild(container);

    // @ts-ignore
    container.querySelectorAll(".xend-ext-settings-row").forEach(el => {
        el.addEventListener("click", e => {
            // @ts-ignore
            container.querySelector("#xendExtSettingsList").style.display = "none";
            // @ts-ignore
            container.querySelector(".xend-ext-settings-detail-title").innerHTML =
                // @ts-ignore
                el.querySelector(".xend-ext-settings-column-left").innerHTML.replace("xend-ext-settings-title", "");
            // @ts-ignore
            container.querySelector("#xendExtSettingsDetail").style.display = "block";

            if (el.id == "xendExtSettingsSubscriptions") {
                // @ts-ignore
                container.querySelector(".xend-ext-settings-detail-right").style.visibility = "visible";
                // @ts-ignore
                container.querySelector(".xend-ext-settings-detail-form").style.visibility = "visible";
            } else {
                // @ts-ignore
                container.querySelector(".xend-ext-settings-detail-right").style.visibility = "hidden";
                // @ts-ignore
                container.querySelector(".xend-ext-settings-detail-form").style.visibility = "hidden";
            }

        }, false);
    });
    // @ts-ignore
    container.querySelector("#xendExtSettingsDetailBack").addEventListener("click", e => {
        // @ts-ignore
        container.querySelector("#xendExtSettingsDetail").style.display = "none";
        // @ts-ignore
        container.querySelector("#xendExtSettingsList").style.display = "block";
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
    container.querySelector("#copyAddress").addEventListener("click", e => {
        // @ts-ignore
        navigator.clipboard.writeText(e.target.dataset.address);
    }, false);
}


const onMutation = async (mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            const nodes = traverseAndFindAttribute(node, 'aside');
            // @ts-ignore
            nodes.forEach((n: any) => {
                const sidebar = n.parentElement.parentElement.parentElement;

                getState(() => {
                    if (!document.getElementById("xendExtStyleList")) {
                        injectStyleList();
                    }


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

                    // Settings
                    //const settingsMenu = n.parentElement.parentElement.cloneNode(true);
                    //createSettings(settingsMenu);
                    //sidebar.insertBefore(settingsMenu, sidebar.children[2]);

                });


            });
        }
    }
};

const mo = new MutationObserver(onMutation);
const observe = () => {
    mo.observe(document, {
        subtree: true,
        childList: true,
    });
};
observe();

const mo2 = new MutationObserver(async (mutations) => {
    for (const mutation of mutations) {
        if (mutation.attributeName === "style") {
            setThemeColors();
        }
    }
});
const observe2 = () => {
    mo2.observe(document.body, {
        attributes: true,
        subtree: false,
        childList: false,
    });
};
observe2();

// Test profile page
setInterval(() => {
    // @ts-ignore
    if (state.authorized && state.walletConnected
        && document.querySelector('a[href="/settings/profile"]')
        && document.querySelector('aside[xend="profile"]')
        // @ts-ignore
        && document.querySelector('aside[xend="profile"]').parentNode.parentNode.style.display == "none"
    ) {
        // @ts-ignore
        document.querySelector('aside[xend="profile"]').parentNode.parentNode.style.display = "";
    } else { // @ts-ignore
        if (!document.querySelector('a[href="/settings/profile"]')
                && document.querySelector('aside[xend="profile"]')
            // @ts-ignore
                && document.querySelector('aside[xend="profile"]').parentNode.parentNode.style.display == ""
            ) {
                // @ts-ignore
            document.querySelector('aside[xend="profile"]').parentNode.parentNode.style.display = "none";
            }
    }
}, 750);

const clearState = () => {
    chrome.storage.local.set({state: ""});
}

// clearState();