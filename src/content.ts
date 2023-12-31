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
import axios from "axios";

// @ts-ignore
import { detect } from 'detect-browser';

const browser = detect();

const logoW = chrome.runtime.getURL("/static/img/xend-small-white.png");
const logoB = chrome.runtime.getURL("/static/img/xend-small-black.png");
const avatarImg = chrome.runtime.getURL("/static/img/avatar.png");
const avatarImg2 = chrome.runtime.getURL("/static/img/avatar2.png");
const styleList = chrome.runtime.getURL("/static/css/style.css");

let isPendingSubscribe = false;
let isPendingBuy = false;
let isPendingSell = false;
let isPendingKeysBuy  = false;
let isPendingKeysSell  = false;
let isPendingUpdatePrice = false;
let isPendingSignup = false;
let isPendingPost = false;

let currentSelectedKeyIdx: any = null;

var port = chrome.runtime.connect({name: "authorize"});

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
        friendtechAddress: ""
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

function setIsPendingSubscribe(val: boolean) {
    isPendingSubscribe = val;
}

function setIsPendingBuy(val: boolean) {
    isPendingBuy = val;
}

function setIsPendingSell(val: boolean) {
    isPendingSell = val;
}

function setIsPendingKeysBuy(val: boolean) {
    isPendingKeysBuy = val;
}

function setIsPendingKeysSell(val: boolean) {
    isPendingKeysSell = val;
}

function setIsPendingUpdatePrice(val: boolean) {
    isPendingUpdatePrice = val;
}

function setIsPendingPost(val: boolean) {
    isPendingPost = val;
}

function setIsPendingSignup(val: boolean) {
    isPendingSignup = val;
}

async function getTokenPrice(tokenAddr: string) {
    try {
        const response = await axios.get(`${apiUrl}/simple/token_price/ethereum?contract_addresses=${tokenAddr}&vs_currencies=usd&include_market_cap=true`);
        const tokenPrice = response.data[tokenAddr.toLowerCase()].usd;
        return tokenPrice;
    } catch (error: any) {
        console.error('Error fetching token price:', error.message);
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
async function signMessage(message, provider, signer) {
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

function getPrice(price: any) {
    let nPrice = price * 1;
    return nPrice.toFixed(5);
}

function getTotalPrice(price: any, balance: any) {
    let nPrice = price * 1;
    let nBalance = balance * 1;
    return (nPrice * nBalance).toFixed(5);
}

function setThemeColors() {
    console.log("=== setThemeColors ===");
    const primaryColumn = document.querySelector('div[data-testid="primaryColumn"]');

    if (primaryColumn) {
        // @ts-ignore
        const compStyles = window.getComputedStyle(primaryColumn);
        console.log("--xendhorline", compStyles.borderColor);
        // @ts-ignore
        document.querySelector(':root').style.setProperty('--xendhorline', compStyles.borderColor);
    }
    
    const inp = document.querySelector('form[aria-label="Search"] input');

    if (inp) {
        // @ts-ignore
        const compStyles = window.getComputedStyle(inp);
        console.log("--xendmaincolor", compStyles.color);
        // @ts-ignore
        document.querySelector(':root').style.setProperty('--xendmaincolor', compStyles.color);
    }
    
    const searchIcon = document.querySelector('form[aria-label="Search"] svg');

    if (searchIcon) {
        // @ts-ignore
        const compStyles = window.getComputedStyle(searchIcon);
        console.log("--xendsecondcolor", compStyles.color);
        // @ts-ignore
        document.querySelector(':root').style.setProperty('--xendsecondcolor', compStyles.color);
    }
    
    const link = document.querySelector('a');

    if (link) {
        // @ts-ignore
        const compStyles = window.getComputedStyle(link);
        console.log("--xendlinkcolor", compStyles.color);
        // @ts-ignore
        document.querySelector(':root').style.setProperty('--xendlinkcolor', compStyles.color);
    }

    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (isDarkMode) {
        // @ts-ignore
        document.querySelector(':root').style.setProperty('--xendcommentcolor', "#363636");
        // @ts-ignore
        document.querySelector(':root').style.setProperty('--xendkeycolor', "#DFDFDF");
        // @ts-ignore
        document.querySelector(':root').style.setProperty('--xendbuttonwhite', "#FFFFFF");
        // @ts-ignore
        document.querySelector(':root').style.setProperty('--xendpricecolor', "#FFFFFF");
        // @ts-ignore
        document.querySelector(':root').style.setProperty('--xendfriendtechcolor', "#393939");
    } else {
        // @ts-ignore
        document.querySelector(':root').style.setProperty('--xendcommentcolor', "#DFDFDF");
        // @ts-ignore
        document.querySelector(':root').style.setProperty('--xendkeycolor', "#DFDFDF");
        // @ts-ignore
        document.querySelector(':root').style.setProperty('--xendpricecolor', "#FFFFFF");
        // @ts-ignore
        document.querySelector(':root').style.setProperty('--xendfriendtechcolor', "#DFDFDF");
    }
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
    let provider = null;
    try {
        let currentMetaMaskId = getMetaMaskId();
        const metamaskPort = chrome.runtime.connect(currentMetaMaskId);
        const pluginStream = new PortDuplexStream(metamaskPort);
        provider = new MetaMaskInpageProvider(pluginStream);
    } catch (e) {
        return null;
    }
    return provider;
}

function showWalletModal(header: any, body: any) {
    // @ts-ignore
    document.querySelector("#walletModalHeaderTxt").innerHTML = header;
    // @ts-ignore
    document.querySelector("#walletModalMainTxt").innerHTML = body;
    // @ts-ignore
    document.querySelector("#walletModal").style.display = "";   
}

function showDashboardModal(header: any, body: any) {
    // @ts-ignore
    document.querySelector("#dashboardModalHeaderTxt").innerHTML = header;
    // @ts-ignore
    document.querySelector("#dashboardModalMainTxt").innerHTML = body;
    // @ts-ignore
    document.querySelector("#dashboardModal").style.display = "";   
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

function disablePost() {
    // @ts-ignore
    document.querySelector("#xend-ext-dashboard-profile-post").disabled = true;
    // @ts-ignore
    document.querySelector("#xend-ext-dashboard-profile-post").classList.add("spinner-button-loading");
    setIsPendingPost(true);
}

function enablePost() {
    // @ts-ignore
    document.querySelector("#xend-ext-dashboard-profile-post").disabled = false;
    // @ts-ignore
    document.querySelector("#xend-ext-dashboard-profile-post").classList.remove("spinner-button-loading");
    setIsPendingPost(false);
}

function disableSignUp() {
    // @ts-ignore
    document.querySelector("#xend-ext-signup-btn").disabled = true;
    // @ts-ignore
    document.querySelector("#xend-ext-signup-btn").classList.add("spinner-button-loading");
    setIsPendingSignup(true);
}

function enableSignUp() {
    // @ts-ignore
    document.querySelector("#xend-ext-signup-btn").disabled = false;
    // @ts-ignore
    document.querySelector("#xend-ext-signup-btn").classList.remove("spinner-button-loading");
    setIsPendingSignup(false);
}

function getShortHash(hash: string) {
    if (hash.length < 20) {
        return hash;
    }
    return hash.slice(0, 6) + " ... " + hash.slice(hash.length - 4, hash.length);
}

function traverseAndFindAttribute(node: any, tagName: string): any {
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

function createCommentsForm(container: any, postID: any, comments: any) {
    let items: string[] = [];
    console.log("createCommentsForm");
    if (!comments) {
        return "";
    }
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
        <img class="xend-ext-comments-avatar" src="${(state.user.avatar)? state.user.avatar: avatarImg2}" alt="" draggable="false" />
        <div class="xend-ext-comment"><input type="text" placeholder="Add a comment"/><a href="#" data-pid="${postID}">Post</a></div>
      </div>
    `;
}

function createFeedCommentsForm(postID: any, comments: any, authorUID: any) {
    let items: string[] = [];
    console.log("createFeedCommentsForm");
    if (!comments) {
        return "";
    }
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
        <img class="xend-ext-comments-avatar" src="${(state.user.avatar)? state.user.avatar: avatarImg2}" alt="" draggable="false" />
        <div class="xend-ext-feedcomment"><input type="text" placeholder="Add a comment"/><a href="#" data-uid="${authorUID}" data-pid="${postID}">Post</a></div>
      </div>
    `;
}

function getFeed(data: any) {
    let items: string[] = [];
  
    if (data == null) {
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
        let priceXend = 0;
        let priceFriendTech = 0;
        let balanceXend = 0;
        let balanceFriendTech = 0;
        let name= "";
        let avatar = "";
        if (data.keys[i]["xend"]) {
            priceXend = Number(data.keys[i]["xend"].price);
            balanceXend = Number(data.keys[i]["xend"].balance);
            name = data.keys[i]["xend"].name;
            avatar = data.keys[i]["xend"].avatar;
        }
        if  (data.keys[i]["friendtech"]) {
            priceFriendTech = Number(data.keys[i]["friendtech"].price);
            balanceFriendTech = Number(data.keys[i]["friendtech"].balance);
            name = data.keys[i]["friendtech"].name;
            avatar = data.keys[i]["friendtech"].avatar;
        }
        content += `<div class="xend-ext-dashboard-keys-row" data-name=${name} >
                        <div class="xend-ext-dashboard-column-left">         
                            <img class="xend-ext-dashboard-keys-logo" src="${avatar}" alt="avatar" draggable="false" />
                            <div class="xend-ext-dashboard-keys-user">
                                <a href="/${name}">@${name}</a>
                                <div>${getPrice(priceXend)}/${getPrice(priceFriendTech)}</div>
                            </div>
                        </div>
                        <div class="xend-ext-dashboard-column-right">
                            <div class="xend-ext-keys-value">
                                <div class="xend-ext-keys-keyset">
                                    <div class="xend-ext-keys-friendtech-key">${balanceFriendTech}</div>
                                    <div class="xend-ext-keys-xend-key">${balanceXend}</div>
                                </div>
                                <div>
                                    <div class="xend-ext-dashboard-currency"></div>
                                    <span>${((priceXend * balanceXend) + (priceFriendTech * balanceFriendTech)).toFixed(5)}</span>  
                                </div>
                            </div>
                            <div class="xend-ext-keys-direction xend-ext-keys-arrow-down"></div>
                        </div>
                        <div style="clear: both"></div>
                    </div>
                    <div class="xend-ext-dashboard-keys-toolset" data-mode="xend">
                        <div class="xend-ext-dashboard-keys-trade xend-ext-dashboard-key-row">
                            <div class="xend-ext-dashboard-keys-switch">
                                <button class="xend-ext-dashboard-keys-xend xend-ext-dashboard-switch-platform">
                                    <div></div>
                                </button>
                                <button class="xend-ext-dashboard-keys-friendtech xend-ext-dashboard-switch-platform">
                                    <div></div>
                                </button>
                            </div>
                            <div class="xend-ext-dashboard-key">
                                <input type="number" value="0" class="xend-ext-dashboard-keys-input xend-ext-menu-key-value" />
                                <div class="xend-ext-menu-btn-set">
                                    <button class="xend-ext-dashboard-keys-buy spinner-button">
                                        <span class="spinner-button-text">Buy</span>
                                    </button>
                                    <div class="xend-ext-menu-key-price">
                                        <div class="xend-ext-menu-key-currency"></div>
                                        <span class="xend-ext-dashboard-buy-price">0</span>
                                    </div>
                                </div>
                                <div class="xend-ext-menu-btn-set">
                                    <button class="xend-ext-dashboard-keys-sell spinner-button">
                                        <span class="spinner-button-text">Sell</span>
                                    </button>
                                    <div class="xend-ext-menu-key-price">
                                        <div class="xend-ext-menu-key-currency"></div>
                                        <span class="xend-ext-dashboard-sell-price">0</span>
                                    </div>
                                </div>
                            </div>
                        </div> 
                    </div>`;
    }
    return content;
}

function getKeys(data: any) {
    let content = 
        `<div class="xend-ext-dashboard-keys">
            <img id="xend-ext-dashboard-keys-avatar" class="xend-ext-dashboard-keys-logo" src="${data.avatar}" alt="avatar" draggable="false" />
            <div class="xend-ext-dashboard-keys-detail">
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

async function addOverLayToImages() {
    const images1 = document.querySelectorAll('.xend-ext-comments-avatar');
    const images2 = document.querySelectorAll('.xend-ext-dashboard-avatar');

    images1.forEach((image) => {
      image.addEventListener('click', () => {
        const overlay = document.createElement('div');
        overlay.classList.add('overlay');
    
        const overlayImage = document.createElement('img');
        overlayImage.classList.add('overlay-image');

        // @ts-ignore
        overlayImage.src = image.src;
        // @ts-ignore
        overlayImage.alt = image.alt;
    
        overlay.appendChild(overlayImage);
        document.body.appendChild(overlay);
    
        overlay.addEventListener('click', () => {
          overlay.remove();
        });
      });
    });

    images2.forEach((image) => {
        image.addEventListener('click', () => {
          const overlay = document.createElement('div');
          overlay.classList.add('overlay');
      
          const overlayImage = document.createElement('img');
          overlayImage.classList.add('overlay-image');
  
          // @ts-ignore
          overlayImage.src = image.src;
          // @ts-ignore
          overlayImage.alt = image.alt;
      
          overlay.appendChild(overlayImage);
          document.body.appendChild(overlay);
      
          overlay.addEventListener('click', () => {
            overlay.remove();
          });
        });
    });
}

///////////////////////////////////////////////////////////////////////////////////////
async function getProvider() {
    // @ts-ignore
    if (window.ethereum) {
        // @ts-ignore
        return window.ethereum;
    } else {
        const provider = getInPageProvider();
        
        // try {
        //     // @ts-ignore
        //     const chainId = await provider.request({ method: "eth_chainId" });
        // } catch (error) {   
        //     console.log("Check Metamask: ", error);
        //     // alert("Please install Metamask");
        //     // logout();
        //     // window.open('https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn', '_blank');
        //     return null;
        // }
        return provider;
    }
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

        if (chain != chainId) {
            const result = await switchChainEth(provider);
            if (!result) {
                alert("Please switch to Ethereum Mainnet.");
                return [];
            }
        }
        return [accounts, chain];
    }
    return [];
}

async function getAccountsBase(provider: AnyNaptrRecord) {
    if (provider) {
        const [accounts, chainId] = await Promise.all([
            // @ts-ignore
            provider.request({
                method: 'eth_requestAccounts',
            }),
            // @ts-ignore
            provider.request({ method: 'eth_chainId' }),
        ]);

        if (friendTechChain != chainId) {
            const result = await switchChainBase(provider);
            if (!result) {
                alert("Please switch to Base Chain.");
                return [];
            }
        }
        return [accounts, chain];
    }
    return [];
}
// @ts-ignore
async function switchChainEth(provider) {
    try {
        // @ts-ignore
        const res = await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${chain.toString(16)}` }],
        });

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

                return true;
            } catch (error) {
                console.error("request2: ", error);
            }
        } else {
            console.error("request3: ", error);
        }
    }
    let res: boolean = await switchChainEth(provider);
    return res;
}

// @ts-ignore
async function switchChainBase(provider) {
    try {
        // @ts-ignore
        const res = await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${friendTechChain.toString(16)}` }],
        });

        return true;
    } catch (error) {
        // @ts-ignore
        if (error.code === 4902) {
            try {
                // @ts-ignore
                const res = provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: `0x${friendTechChain.toString(16)}`,
                        rpcUrls: ['https://base.llamarpc.com'],
                        chainName: 'Base LlamaNodes',
                        nativeCurrency: {
                            name: 'Ethereum',
                            symbol: 'ETH',
                            decimals: 18,
                        },
                        blockExplorerUrls: ['https://basescan.org'],
                    }],
                });

                return true;
            } catch (error) {
                console.error("request2: ", error);
            }
        } else {
            console.error("request3: ", error);
        }
    }
    let res: boolean = await switchChainBase(provider);
    return res;
}

async function login() {
    // @ts-ignore
    if (state.authorized && document.querySelector('aside[xend="wallet"]') && document.querySelector('aside[xend="wallet"]').parentNode.parentNode.style.display == "none") {
        // @ts-ignore
        document.querySelector('aside[xend="login"]').parentNode.parentNode.style.display = "none";
        // @ts-ignore
        document.querySelector('aside[xend="wallet"]').parentNode.parentNode.style.display = "";
        return;
    }
    port = chrome.runtime.connect({name: "authorize"});
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
            document.querySelector("#xend-ext-settings-avatar").src = state.user.avatar;
            // @ts-ignore
            document.querySelector("#xend-ext-settings-user").innerHTML = state.user.name;
            // @ts-ignore
            document.querySelector("#xend-ext-menu-avatar").src = state.user.avatar;
            // @ts-ignore
            document.querySelector("#xend-ext-menu-user").innerHTML = state.user.name;
            // @ts-ignore
            document.querySelector("#xend-ext-wallet-avatar").src = state.user.avatar;
            // @ts-ignore
            document.querySelector("#xend-ext-wallet-user").innerHTML = state.user.name;
            // @ts-ignore
            document.querySelector("#xend-ext-signup-avatar").src = state.user.avatar;
            // @ts-ignore
            document.getElementById("xend-ext-signup-user").innerHTML = state.user.name;
            // @ts-ignore
            document.getElementById("xend-ext-dashboard-setting-avatar").src = state.user.avatar;
            // @ts-ignore
            document.getElementById("xend-ext-dashboard-keys-avatar").src = state.user.avatar;

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
    let provider = await getProvider();
    try {
        //@ts-ignore
        const [accounts, chainId] = await getAccounts(provider);
        if (accounts && chainId) {
            const account = getNormalizeAddress(accounts);
           
            if (state.user.address != "") {
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
    const res = await connectWalletFunc();
    if (!res.result) {
        return;
    }
    state.walletConnected = true;
    chrome.storage.local.set({ state });

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
        const prov = await getProvider();
        const provider = new ethers.providers.Web3Provider(prov);

        signer = provider.getSigner();
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
                chrome.storage.local.set({ state });
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
    port = chrome.runtime.connect({name: "authorize"});
    port.postMessage({
        task: "setWalletAddr",
        address: currentWalletAddress,
        uid: state.user.uid,
        token: state.token,
        secret: state.secret,
        signature: signature,
        message: message
    });
    port.onMessage.addListener(async function(msg: any) {
        if (msg.result === "statusWalletSet") {
            console.log("statusWalletSet: ", msg.result);
            if (msg.status) {
                state.user.address = currentWalletAddress;
                state.signedUp = true;

                chrome.storage.local.set({ state });
            
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
    });
}

async function signUp() {
    disableSignUp();

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

    if (referrer == "") {
        console.log("referrer1: ", referrer);

        const prov = await getProvider();
        const provider = new ethers.providers.Web3Provider(prov);

        const [accounts, chainId] = await getAccounts(prov);

        if (chainId != chain) {
            showWalletModal("Alert", "Please switch to Ethereum Mainnet");
            switchChainEth(prov);
            enableSignUp();
            return;
        }

        signer = provider.getSigner();
        xendContract = new ethers.Contract(address, abi, provider);

        let message = `Hello, This is ${state.user.name}`;
        const signature = await signMessage(message, prov, signer);
        if (signature == null) {
            alert("Please Sign.");
            enableSignUp();
            return;
        }
        
        try {
            const result = await xendContract.connect(signer)["signUp"]([]);
            console.log(result);
            if (!result.hash) {
                enableSignUp();
                return;
            }
            // @ts-ignore
            result.wait().then(res => {
                enableSignUp();
                successSignup(signature, message);
            });
        } catch (error: any) {
            console.log("signUpError", error.error);
            enableSignUp();
            if (error.error.message == "execution reverted: User is already signed up") {
                state.signedUp = true;

                chrome.storage.local.set({ state });
            
                // @ts-ignore
                document.querySelector('aside[xend="signup"]').parentNode.parentNode.style.display = "none";
                await checkURL(false);
                // @ts-ignore
                document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "";      
            }
            return;
        }
    } else {
        port = chrome.runtime.connect({name: "authorize"});
        port.postMessage({ 
            task: "getAddrByname", 
            name: referrer, 
            token: state.token, 
            secret: state.secret 
        });
    
        port.onMessage.addListener(async function(msg: any) {
            if (msg.result === "successGetAddrByName") {
                console.log("successGetAddrByName: ", msg);
                if (!msg.address) {
                    // @ts-ignore
                    document.getElementById("xend-ext-signup-referrer-alert").innerHTML = "Unregistered Username!";
                    enableSignUp();
                    return;
                }
                referrer = msg.address;
                console.log("referrer4: ", referrer);
        
                const prov = await getProvider();
                const provider = new ethers.providers.Web3Provider(prov);

                const [accounts, chainId] = await getAccounts(prov);

                if (chainId != chain) {
                    showWalletModal("Alert", "Please switch to Ethereum Mainnet");
                    switchChainEth(prov);
                    enableSignUp();
                    return;
                }

                signer = provider.getSigner();
                xendContract = new ethers.Contract(address, abi, provider);

                let message = `Hello, This is ${state.user.name}`;
                const signature = await signMessage(message, prov, signer);
                if (signature == null) {
                    alert("Please Sign.");
                    enableSignUp();
                    return;
                }

                try {
                    const result = await xendContract.connect(signer)["signUpWithReferral"](referrer);
                    console.log(result);
                    if (!result.hash) {
                        enableSignUp();
                        return;
                    }
                    // @ts-ignore
                    result.wait().then(res => {
                        enableSignUp();
                        successSignup(signature, message);
                    });
                } catch (error: any) {
                    console.log("signUpError", error.error);
                    enableSignUp();
                    if (error.error.message == "execution reverted: User is already signed up") {
                        state.signedUp = true;
        
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
        });
    }   
}

function logout() {
    // @ts-ignore
    if (state.file != "") {
        // @ts-ignore
        state.file = "";
        // @ts-ignore
        if (document.getElementById("addFile") != null) {
            // @ts-ignore
            document.getElementById("addFile").value = null;
            // @ts-ignore
            document.getElementById('removeFile').style.backgroundImage = "";
            // @ts-ignore
            document.getElementById('removeFile').style.visibility = "hidden";
        }
    }

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

async function updateFeedPage() {
    port = chrome.runtime.connect({name: "authorize"});
    port.postMessage({
        task: "getFeeds",
        uid: state.user.uid,
        token: state.token,
        secret: state.secret,
        start: 0,
        num: state.user.feedPageSize
    });

    port.onMessage.addListener(function(msg) {
        if (msg.result === "successGetFeeds") {
            state.user.feedCount = msg.count;
            state.feed = msg.results;

            chrome.storage.local.set({ state });
            // @ts-ignore
            document.getElementById("xend-ext-dashboard-profile-feeds").innerHTML = getFeed(msg.results) + `<div id="xend-ext-feed-loader">&nbsp;</div>`;

            addOverLayToImages();
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
                el.addEventListener("click", (e: any) => {
                    e.preventDefault();

                    console.log("Feed Comment Post");
                    // @ts-ignore
                    const content = e.target.previousElementSibling.value.trim();
                    // @ts-ignore
                    const pid = e.target.dataset.pid;
                    // @ts-ignore
                    const uid = e.target.dataset.uid;
                    port = chrome.runtime.connect({name: "authorize"});
                    // @ts-ignore
                    port.postMessage({
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
                    port.onMessage.addListener(function(msg) {
                        if (msg.result === "successPostFeedComment") {
                            state.feed = msg.articles;

                            updateFeedPage();
                
                            chrome.storage.local.set({ state });
                        }
                    });
                });
            });

            // @ts-ignore
            document.getElementById("xend-ext-dashboard-profile-feeds").addEventListener("scroll", e => {
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
                    port = chrome.runtime.connect({name: "authorize"});
                    // @ts-ignore
                    port.postMessage({
                        task: "getFeeds",
                        uid: state.user.uid,
                        token: state.token,
                        secret: state.secret,
                        start: 0,
                        range: numOfArticles + state.user.feedPageSize
                    });

                    port.onMessage.addListener(function(msg) {
                        if (msg.result === "successGetFeeds") {
                            if (state.feed.length == msg.count || msg.results.length == 0) {
                                state.loadingFeeds = false;
                                return;
                            }
                            console.log("successGetFeeds", numOfArticles, msg);
                            state.feed = msg.results;
        
                            // @ts-ignore
                            const item = getFeed(msg.results);
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
                                el.addEventListener("click", (e: any) => {
                                    e.preventDefault();

                                    console.log("Feed Comment Post");
                                    // @ts-ignore
                                    const content = e.target.previousElementSibling.value.trim();
                                    // @ts-ignore
                                    const pid = e.target.dataset.pid;
                                    // @ts-ignore
                                    const uid = e.target.dataset.uid;
                                    port = chrome.runtime.connect({name: "authorize"});
                                    // @ts-ignore
                                    port.postMessage({
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
                                    port.onMessage.addListener(function(msg) {
                                        if (msg.result === "successPostFeedComment") {
                                            console.log("successPostFeedComment: ", msg.articles);
                                            state.user.articles = msg.articles;

                                            updateFeedPage();
                                
                                            chrome.storage.local.set({ state });
                                        }
                                    });
                                });
                            });
                            // @ts-ignore
                            document.querySelector("#xend-ext-dashboard-profile-feeds").scrollTop = scrollTop;
                            state.loadingFeeds = false;
                            chrome.storage.local.set({ state });
                        }
                    });
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
    });
}

function showWarningMessage(msg: any) {
    console.log("Show Warning Message");
    // @ts-ignore
    document.querySelector("#xend-ext-dashboard-warning").style.visibility = "visible";
    // @ts-ignore
    document.querySelector("#xend-ext-dashboard-warningmsg").innerHTML = msg;
}

function hideWarningMessage() {
    console.log("Hide Warning message");
    // @ts-ignore
    document.querySelector("#xend-ext-dashboard-warning").style.visibility = "hidden";
}

async function buyFriendTechKey(btn: any, addr: any, amt: any, callback: any, openModal: any, setStatus: any) {
    console.log("buyFriendTechKey", addr, amt);

    const provider = await getProvider();
    const prov = new ethers.providers.Web3Provider(provider);
    
    const [accounts, chainId] = await getAccountsBase(provider);
    const account = getNormalizeAddress(accounts);

    if (account.toLowerCase() != state.user.friendtechAddress.toLowerCase()) {
        // @ts-ignore
        btn.disabled = false;
        // @ts-ignore
        btn.classList.remove("spinner-button-loading");
        setStatus(false);
        showWarningMessage("Wrong wallet connected on Metamask");
        openModal("Wrong Wallet.", `Connect your paired Friend Tech wallet, ${getShortHash(state.user.friendtechAddress)} to continue.`);
        return;
    }

    if (chainId != friendTechChain) {
        // @ts-ignore
        btn.disabled = false;
        // @ts-ignore
        btn.classList.remove("spinner-button-loading");
        setStatus(false);
        showWarningMessage("Wrong chain selected on Metamask");
        openModal("Alert.", "Please switch chain to Base chain.");
        return;
    }

    hideWarningMessage();

    let signer = prov.getSigner();
    let friendTechContract = new ethers.Contract(friendTechAddress, friendTechABI, prov);
    
    try {
        let price = await friendTechContract.connect(signer)["getBuyPriceAfterFee"](addr, amt);
    
        const result = await friendTechContract.connect(signer)["buyShares"](addr, amt, {
            value: parseInt(price._hex).toString()
        });
    
        if (!result.hash) {
            // @ts-ignore
            btn.disabled = false;
            // @ts-ignore
            btn.classList.remove("spinner-button-loading");
            setStatus(false);
            openModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
            return;
        }
        // @ts-ignore
        result.wait().then(res => {
            console.log(res);
            // @ts-ignore
            if (res.status == 1) {
                // @ts-ignore
                btn.disabled = false;
                // @ts-ignore
                btn.classList.remove("spinner-button-loading");
                setStatus(false);
                setTimeout(() => {
                    callback();
                }, 1000);
            } else {
                // @ts-ignore
                btn.disabled = false;
                // @ts-ignore
                btn.classList.remove("spinner-button-loading");
                setStatus(false);
                openModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
            }
        });
    } catch (error) {
        console.log(error);
        // @ts-ignore
        btn.disabled = false;
        // @ts-ignore
        btn.classList.remove("spinner-button-loading");
        setStatus(false);
        // @ts-ignore
        if (error.code == "ACTION_REJECTED") {
            openModal("Alert!", "You have rejected Transaction.");
        } else {
            openModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
        }
    }
}

async function sellFriendTechKey(btn: any, addr: any, amt: any, callback: any, openModal: any, setStatus: any) {
    console.log("sellFriendTechKey", addr, amt);

    const provider = await getProvider();
    const prov = new ethers.providers.Web3Provider(provider);
    
    const [accounts, chainId] = await getAccountsBase(provider);
    const account = getNormalizeAddress(accounts);

    if (account.toLowerCase() != state.user.friendtechAddress.toLowerCase()) {
        // @ts-ignore
        btn.disabled = false;
        // @ts-ignore
        btn.classList.remove("spinner-button-loading");
        setStatus(false);
        showWarningMessage("Wrong wallet connected on Metamask");
        openModal("Wrong Wallet.", `Connect your paired Friend Tech wallet, ${getShortHash(state.user.friendtechAddress)} to continue.`);
        return;
    }

    if (chainId != friendTechChain) {
        // @ts-ignore
        btn.disabled = false;
        // @ts-ignore
        btn.classList.remove("spinner-button-loading");
        setStatus(false);
        showWarningMessage("Wrong chain selected on Metamask");
        openModal("Alert.", "Please switch chain to Base chain.");
        return;
    }

    hideWarningMessage();

    let signer = prov.getSigner();
    let friendTechContract = new ethers.Contract(friendTechAddress, friendTechABI, prov);

    try {
        let price = await friendTechContract.connect(signer)["getSellPriceAfterFee"](addr, amt);

        const result = await friendTechContract.connect(signer)["sellShares"](address, amt, {
            value: parseInt(price._hex).toString()
        });

        if (!result.hash) {
            // @ts-ignore
            btn.disabled = false;
            // @ts-ignore
            btn.classList.remove("spinner-button-loading");
            setStatus(false);
            openModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
            return;
        }
        // @ts-ignore
        result.wait().then(res => {
            // @ts-ignore
            if (res.status == 1) {
                // @ts-ignore
                btn.disabled = false;
                // @ts-ignore
                btn.classList.remove("spinner-button-loading");
                setStatus(false);
                
                setTimeout(() => {
                    callback();
                }, 1000);
            } else {
                // @ts-ignore
                btn.disabled = false;
                // @ts-ignore
                btn.classList.remove("spinner-button-loading");
                setStatus(false);
                openModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
            }
        });
    } catch (error) {
        console.log("sellKey", error);
        // @ts-ignore
        btn.disabled = false;
        // @ts-ignore
        btn.classList.remove("spinner-button-loading");
        setStatus(false);
        // @ts-ignore
        if (error.code == "ACTION_REJECTED") {
            openModal("Alert!", "You have rejected Transaction.");
        // @ts-ignore
        } else if (error.code == "UNPREDICTABLE_GAS_LIMIT") {
            openModal("Alert.", "Please input the lower value than your balance.");
        } else {
            openModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
        }
    }
}

async function buyXendKey(btn: any, addr: any, amt: any, callback: any, openModal: any, setStatus: any) {
    console.log("buyXendKey", addr, amt);

    const provider = await getProvider();
    const prov = new ethers.providers.Web3Provider(provider);
    
    const [accounts, chainId] = await getAccounts(provider);
    const account = getNormalizeAddress(accounts);

    if (account.toLowerCase() != state.user.address.toLowerCase()) {
        // @ts-ignore
        btn.disabled = false;
        // @ts-ignore
        btn.classList.remove("spinner-button-loading");
        setStatus(false);
        showWarningMessage("Wrong wallet connected on Metamask");
        openModal("Wrong Wallet.", `Connect your paired Xend wallet, ${getShortHash(state.user.address)} to continue.`);
        return;
    }

    if (chainId != chain) {
        // @ts-ignore
        btn.disabled = false;
        // @ts-ignore
        btn.classList.remove("spinner-button-loading");
        setStatus(false);
        showWarningMessage("Wrong chain selected on Metamask");
        openModal("Alert.", "Please switch chain to Ethereum Mainnet.");
        return;
    }

    hideWarningMessage();

    let signer = prov.getSigner();
    xendContract = new ethers.Contract(address, abi, prov);

    try {
        let price = await xendContract.connect(signer)["getBuyPriceAfterFee"](addr, amt);
        price = parseInt(price._hex).toString();

        console.log("buyXendKey", price);

        const result = await xendContract.connect(signer)["buyShares"](addr, amt, {
            value: price
        });

        if (!result.hash) {
            // @ts-ignore
            btn.disabled = false;
            // @ts-ignore
            btn.classList.remove("spinner-button-loading");
            setStatus(false);
            openModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
            return;
        }
        // @ts-ignore
        result.wait().then(res => {
            // @ts-ignore
            if (res.status == 1) {
                // @ts-ignore
                btn.disabled = false;
                // @ts-ignore
                btn.classList.remove("spinner-button-loading");
                setStatus(false);
                
                setTimeout(() => {
                    callback();
                }, 1000);
            } else {
                // @ts-ignore
                btn.disabled = false;
                // @ts-ignore
                btn.classList.remove("spinner-button-loading");
                setStatus(false);
                openModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
            }
        });
    } catch (error) {
        // @ts-ignore
        console.log("buyKey", error.code);
        // @ts-ignore
        btn.disabled = false;
        // @ts-ignore
        btn.classList.remove("spinner-button-loading");
        setStatus(false);
        // @ts-ignore
        if (error.code == "ACTION_REJECTED") {
            openModal("Alert!", "You have rejected Transaction.");
        } else {
            openModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
        }
    }
}

async function sellXendKey(btn: any, addr: any, amt: any, callback: any, openModal: any, setStatus: any) {
    console.log("sellXendKey", addr, amt);

    const provider = await getProvider();
    const prov = new ethers.providers.Web3Provider(provider);

    const [accounts, chainId] = await getAccounts(provider);
    const account = getNormalizeAddress(accounts);

    if (account.toLowerCase() != state.user.address.toLowerCase()) {
        // @ts-ignore
        btn.disabled = false;
        // @ts-ignore
        btn.classList.remove("spinner-button-loading");
        setStatus(false);
        showWarningMessage("Wrong wallet connected on Metamask");
        openModal("Wrong Wallet.", `Connect your paired Xend wallet, ${getShortHash(state.user.address)} to continue.`);
        return;
    }

    if (chainId != chain) {
        // @ts-ignore
        btn.disabled = false;
        // @ts-ignore
        btn.classList.remove("spinner-button-loading");
        setStatus(false);
        showWarningMessage("Wrong chain selected on Metamask");
        openModal("Alert.", "Please switch chain to Ethereum Mainnet.");
        return;
    }

    hideWarningMessage();

    let signer = prov.getSigner();
    xendContract = new ethers.Contract(address, abi, prov);

    try {
        let price = await xendContract.connect(signer)["getSellPriceAfterFee"](addr, amt);

        const result = await xendContract.connect(signer)["sellShares"](addr, amt, {
            value: parseInt(price._hex).toString()
        });

        if (!result.hash) {
            // @ts-ignore
            btn.disabled = false;
            // @ts-ignore
            btn.classList.remove("spinner-button-loading");
            setStatus(false);
            openModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
            return;
        }
        // @ts-ignore
        result.wait().then(res => {
            // @ts-ignore
            if (res.status == 1) {
                // @ts-ignore
                btn.disabled = false;
                // @ts-ignore
                btn.classList.remove("spinner-button-loading");
                setStatus(false);
                
                setTimeout(() => {
                    callback();
                }, 1000);
            } else {
                // @ts-ignore
                btn.disabled = false;
                // @ts-ignore
                btn.classList.remove("spinner-button-loading");
                setStatus(false);
                openModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
            }
        });
    } catch (error) {
        console.log("sellKey", error);
        // @ts-ignore
        console.log("sellKey", error.code, error.message);
        // @ts-ignore
        btn.disabled = false;
        // @ts-ignore
        btn.classList.remove("spinner-button-loading");
        setStatus(false);
        // @ts-ignore
        if (error.code == "ACTION_REJECTED") {
            openModal("Alert!", "You have rejected Transaction.");
        // @ts-ignore
        } else if (error.code == "UNPREDICTABLE_GAS_LIMIT") {
            openModal("Alert.", "Please input the lower value than your balance.");
        } else {
            openModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
        }
    }
}

async function getXendPrice(addr: any, amt: any, openModal: any) {
    console.log("getXendPrice", addr, amt);

    const provider = await getProvider();
    const prov = new ethers.providers.Web3Provider(provider);

    const [accounts, chainId] = await getAccounts(provider);
    const account = getNormalizeAddress(accounts);

    if (account.toLowerCase() != state.user.address.toLowerCase()) {
        showWarningMessage("Wrong wallet connected on Metamask");
        openModal("Wrong Wallet.", `Connect your paired Xend wallet, ${getShortHash(state.user.address)} to continue.`);
        return;
    }

    if (chainId != chain) {
        showWarningMessage("Wrong chain selected on Metamask");
        openModal("Alert.", "Please switch chain to Ethereum Mainnet.");
        return;
    }

    hideWarningMessage();

    let signer = prov.getSigner();
    xendContract = new ethers.Contract(address, abi, prov);

    try {
        let sellPrice = await xendContract.connect(signer)["getSellPriceAfterFee"](addr, amt);
        sellPrice = parseInt(sellPrice._hex).toString();
        let buyPrice = await xendContract.connect(signer)["getBuyPriceAfterFee"](addr, amt);
        buyPrice = parseInt(buyPrice._hex).toString();

        return {
            buyPrice: Web3.utils.fromWei(buyPrice, "ether"),
            sellPrice: Web3.utils.fromWei(sellPrice, "ether")
        };
    } catch (error) {
        console.log("GetXendPrice", error);
        return {
            buyPrice: 0,
            sellPrice: 0
        };
    }
}

async function getFriendTechPrice(addr: any, amt: any, openModal: any) {
    console.log("getFriendTechPrice", addr, amt);

    const provider = await getProvider();
    const prov = new ethers.providers.Web3Provider(provider);

    const [accounts, chainId] = await getAccounts(provider);
    const account = getNormalizeAddress(accounts);

    if (account.toLowerCase() != state.user.friendtechAddress.toLowerCase()) {
        setStatus(false);
        showWarningMessage("Wrong wallet connected on Metamask");
        openModal("Wrong Wallet.", `Connect your paired Friend Tech wallet, ${getShortHash(state.user.friendtechAddress)} to continue.`);
        return;
    }

    if (chainId != friendTechChain) {
        setStatus(false);
        showWarningMessage("Wrong chain selected on Metamask");
        openModal("Alert.", "Please switch chain to Base chain.");
        return;
    }

    hideWarningMessage();

    let signer = prov.getSigner();
    let friendTechContract = new ethers.Contract(friendTechAddress, friendTechABI, prov);

    try {
        let sellPrice = await friendTechContract.connect(signer)["getSellPriceAfterFee"](addr, amt);
        sellPrice = parseInt(sellPrice._hex).toString();
        let buyPrice = await friendTechContract.connect(signer)["getBuyPriceAfterFee"](addr, amt);
        buyPrice = parseInt(buyPrice._hex).toString();

        return {
            buyPrice,
            sellPrice
        };
    } catch (error) {
        console.log("getFriendTechPrice", error);
    }
}

async function updateBuySellPageFriendTech() {
    console.log("updateBuySellPageFriendTech");

    let path = window.location.href;
    const prefix = "https://twitter.com/";
    path = path.slice(path.indexOf(prefix) + prefix.length, path.length);

    port.postMessage({
        task: "getFriendTechInfo",
        name: path
    });

    // @ts-ignore
    port.onMessage.addListener(async function(msg: any) {
        if (msg.result === "successGetFriendTechInfo") {
            if (msg.id == null) {
                showBuySellModal("Alert", "You don't have account in Friend.Tech Platform.");
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
            
            const provider = await getProvider();
            const prov = new ethers.providers.Web3Provider(provider);

            signer = prov.getSigner();

            const WETHPrice = await getTokenPrice(addrTokenWETH);
        
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
            document.getElementById("xend-ext-menu-key-input").addEventListener("change", async (e: any) => {
                const prices = await getFriendTechPrice(state.profile.keyAddress, e.target.value, showBuySellModal);
                console.log("getFriendTechPrice", prices);
                // @ts-ignore
                document.getElementById("xend-ext-menu-key-buy-price").innerHTML = (Number(prices?.buyPrice)).toFixed(5);
                // @ts-ignore
                document.getElementById("xend-ext-menu-key-sell-price").innerHTML = (Number(prices?.sellPrice)).toFixed(5);
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

                console.log("xend-ext-menu-key-buy");

                isPendingBuy = true;

                let btn = document.getElementById("xend-ext-menu-key-buy");
                // @ts-ignore
                btn.disabled = true;
                // @ts-ignore
                btn.classList.add("spinner-button-loading");
                // @ts-ignore
                let amt = (document.getElementById("xend-ext-menu-key-input").value) * 1;
        
                if (amt <= 0) {
                    // @ts-ignore
                    btn.disabled = false;
                    // @ts-ignore
                    btn.classList.remove("spinner-button-loading");
                    isPendingBuy = false;
                    showBuySellModal("Alert", "Please input positive value.");
                    return;
                }
        
                buyFriendTechKey(btn, state.profile.keyAddress, amt, () => checkURL(false), showBuySellModal, setIsPendingBuy);
            });

            // @ts-ignore
            document.getElementById("xend-ext-menu-key-sell").addEventListener("click", async (e: any) => {
                if (isPendingSell && isPendingBuy) {
                    return;
                }

                console.log("xend-ext-menu-key-sell");

                isPendingSell = true;
                let btn = document.getElementById("xend-ext-menu-key-sell");
                // @ts-ignore
                btn.disabled = true;
                // @ts-ignore
                btn.classList.add("spinner-button-loading");
                // @ts-ignore
                let amt = (document.getElementById("xend-ext-menu-key-input").value) * 1;
        
                if (amt <= 0) {
                    // @ts-ignore
                    btn.disabled = false;
                    // @ts-ignore
                    btn.classList.remove("spinner-button-loading");
                    isPendingSell = false;
                    showBuySellModal("Alert", "Please input positive value.");
                    return;
                }
        
                sellFriendTechKey(btn, state.profile.keyAddress, amt, () => checkURL(false), showBuySellModal, setIsPendingSell);
            });

            chrome.storage.local.set({ state });

            // @ts-ignore
            document.getElementById("xend-ext-menu-up-trend-wrapper").style.display = "none";
            // @ts-ignore
            document.getElementById("xend-ext-menu-premium-btn").disabled = true;
            // @ts-ignore
            document.getElementById("xend-ext-menu-premium-btn-text").text = "Disabled";
        }
    });
}

async function updateBuySellPageXend() {
    console.log("updateBuySellPageXend");
    
    let pr = await getProvider();

    while (!switchChainEth(pr)) {

    }

    const WETHPrice = await getTokenPrice(addrTokenWETH);

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
    document.getElementById("xend-ext-menu-key-input").addEventListener("change", async (e: any) => {
        const prices = await getXendPrice(state.profile.keyAddress, e.target.value, showBuySellModal);
        console.log("getXendPrice", prices);
        // @ts-ignore
        document.getElementById("xend-ext-menu-key-buy-price").innerHTML = (Number(prices?.buyPrice)).toFixed(5);
        // @ts-ignore
        document.getElementById("xend-ext-menu-key-sell-price").innerHTML = (Number(prices?.sellPrice)).toFixed(5);
    });

    try {
        const prov = await getProvider();
        const provider = new ethers.providers.Web3Provider(prov);

        signer = provider.getSigner();
        subscribeContract = new ethers.Contract(subscribeAddress, subscribeABI, provider);

        const isEnabled = await subscribeContract.connect(signer)["isMonthlySubscriptionEnabled"](state.profile.keyAddress);
        console.log("subscribe", isEnabled);
        state.profile.isSubscriptionEnabled = isEnabled;

        if (isEnabled && state.user.address != state.profile.keyAddress && !state.profile.isSubscribed) {
            const result = await subscribeContract.connect(signer)["monthlySubPrice"](state.profile.keyAddress);
            state.profile.subscribePriceInETH = Web3.utils.fromWei(parseInt(result._hex).toString(), "ether");
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

        const provider = await getProvider();
        const prov = new ethers.providers.Web3Provider(provider);
    
        const [accounts, chainId] = await getAccounts(provider);
        const account = getNormalizeAddress(accounts);
    
        if (account.toLowerCase() != state.user.address.toLowerCase()) {
            // @ts-ignore
            document.getElementById("xend-ext-menu-premium-btn").disabled = false;
            // @ts-ignore
            document.getElementById("xend-ext-menu-premium-btn").classList.remove("spinner-button-loading");
            setIsPendingSubscribe(false);
            showWarningMessage("Wrong wallet connected on Metamask");
            showBuySellModal("Wrong Wallet.", `Connect your paired Xend wallet, ${getShortHash(state.user.address)} to continue.`);
            return;
        }
    
        if (chainId != chain) {
            // @ts-ignore
            document.getElementById("xend-ext-menu-premium-btn").disabled = false;
            // @ts-ignore
            document.getElementById("xend-ext-menu-premium-btn").classList.remove("spinner-button-loading");
            setIsPendingSubscribe(false);
            showWarningMessage("Wrong chain selected on Metamask");
            showBuySellModal("Alert.", "Please switch chain to Ethereum Mainnet.");
            return;
        }
    
        hideWarningMessage();
    
        let signer = prov.getSigner();

        subscribeContract = new ethers.Contract(subscribeAddress, subscribeABI, prov);

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
            // @ts-ignore
            if (error.code == "ACTION_REJECTED") {
                showBuySellModal("Alert!", "You have rejected Transaction.");
            } else {
                showBuySellModal("Transaction Failed.", "Insufficient funds for this transaction, please try again.");
            }
        }
    });

    // @ts-ignore
    document.getElementById("xend-ext-menu-key-buy").addEventListener("click", async (e: any) => {
        if (isPendingBuy && isPendingSell) {
            return;
        }
        isPendingBuy = true;
        let btn = document.getElementById("xend-ext-menu-key-buy")
        // @ts-ignore
        btn.disabled = true;
        // @ts-ignore
        btn.classList.add("spinner-button-loading");
        // @ts-ignore
        let amt = (document.getElementById("xend-ext-menu-key-input").value) * 1;

        if (amt <= 0) {
            // @ts-ignore
            btn.disabled = false;
            // @ts-ignore
            btn.classList.remove("spinner-button-loading");
            isPendingBuy = false;
            showBuySellModal("Alert", "Please input positive value.");
            return;
        }

        buyXendKey(btn, state.profile.keyAddress, amt, () => checkURL(false), showBuySellModal, setIsPendingBuy);
    });

    // @ts-ignore
    document.getElementById("xend-ext-menu-key-sell").addEventListener("click", async (e: any) => {
        if (isPendingSell && isPendingBuy) {
            return;
        }
        isPendingSell = true;
        let btn = document.getElementById("xend-ext-menu-key-sell");
        // @ts-ignore
        btn.disabled = true;
        // @ts-ignore
        btn.classList.add("spinner-button-loading");
        // @ts-ignore
        let amt = (document.getElementById("xend-ext-menu-key-input").value) * 1;

        if (amt <= 0) {
            // @ts-ignore
            btn.disabled = false;
            // @ts-ignore
            btn.classList.remove("spinner-button-loading");
            isPendingSell = false;
            showBuySellModal("Alert", "Please input positive value.");
            return;
        }

        sellXendKey(btn, state.profile.keyAddress, amt, () => checkURL(false), showBuySellModal, setIsPendingSell);
    });

    chrome.storage.local.set({ state });
}

function refreshKeysPage() {
    console.log("refreshKeysPage");
    
    port = chrome.runtime.connect({name: "authorize"});
    port.postMessage({
        task: "getMyKeys",
        uid: state.user.uid,
        token: state.token,
        secret: state.secret,
        address: state.user.address
    });

    port.onMessage.addListener(function(msg) {
        if (msg.result === "successGetMyKeys") {
            state.key.keyBalance = msg.keyBalance;
            state.key.holderNum = msg.holderNum;
            state.key.priceInETH = msg.priceInETH;
            state.key.totalPrice = msg.totalPrice;

            state.keys = msg.myKeys;

            chrome.storage.local.set({ state });

            updateKeysPage();
        }
    });
}

function updateKeysPage() {
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
    const item = getKeys(data);

    // @ts-ignore
    document.getElementById("content-2").innerHTML = item;

    currentSelectedKeyIdx = null;

    let toolSets: any = document.querySelectorAll(".xend-ext-dashboard-keys-toolset");
    let friendtechBtns = document.querySelectorAll(".xend-ext-dashboard-keys-friendtech");
    let xendBtns = document.querySelectorAll(".xend-ext-dashboard-keys-xend");

    for (let i = 0; i < toolSets.length; i++) {
        if (state.keys[i]["xend"]) {
            toolSets[i].dataset.mode = "xend";
            xendBtns[i].classList.add("switch-xend-focus");
        } else {
            toolSets[i].dataset.mode = "friendtech";
            friendtechBtns[i].classList.add("switch-friendtech-focus");
        }
    }
    // @ts-ignore
    document.querySelectorAll(".xend-ext-dashboard-keys-xend").forEach((el: any, idx: any) => {
        el.addEventListener("click", async (e: any) => {
            if (!state.keys[idx]["xend"]) {
                showDashboardModal("Alert", "This user doesn't have Xend Platform.");
                return;
            }

            const provider = await getProvider();
            switchChainEth(provider);

            let toolSets: any = document.querySelectorAll(".xend-ext-dashboard-keys-toolset");
            toolSets[idx].dataset.mode = "xend";

            try {
                el.classList.add("switch-xend-focus");
                let friendtechBtns = document.querySelectorAll(".xend-ext-dashboard-keys-friendtech");
                friendtechBtns[idx].classList.remove("switch-friendtech-focus");
            } catch (error) {

            }
        });
    });
    // @ts-ignore
    document.querySelectorAll(".xend-ext-dashboard-keys-friendtech").forEach((el: any, idx: any) => {
        el.addEventListener("click", async (e: any) => {
            if (!state.keys[idx]["friendtech"]) {
                showDashboardModal("Alert", "This user doesn't have account in Friend Tech Platform.");
                return;
            }

            const provider = await getProvider();
            switchChainBase(provider);

            port = chrome.runtime.connect({name: "authorize"});
            port.postMessage({
                task: "getMyFriendTechInfo",
                name: state.user.name
            });
            port.onMessage.addListener(function(msg: any) {
                if (msg.result === "successGetMyFriendTechInfo") {
                    if (!msg.address) {
                        showDashboardModal("Alert", "You don't have account in Friend Tech Platform.");
                        return;
                    }

                    state.user.friendtechAddress = msg.address;

                    chrome.storage.local.set({ state });

                    let toolSets: any = document.querySelectorAll(".xend-ext-dashboard-keys-toolset");
                    toolSets[idx].dataset.mode = "friendtech";

                    try {
                        el.classList.add("switch-friendtech-focus");
                        let xendBtns = document.querySelectorAll(".xend-ext-dashboard-keys-xend");
                        xendBtns[idx].classList.remove("switch-xend-focus");
                    } catch (error) {
        
                    }
                }
            });
        });
    });
    // @ts-ignore
    document.querySelectorAll(".xend-ext-dashboard-keys-input").forEach((el: any, idx: any) => {
        el.addEventListener("change", async (e: any) => {
            let toolSets: any = document.querySelectorAll(".xend-ext-dashboard-keys-toolset");
            let mode: any = toolSets[idx].dataset.mode;
            let buyPrices: any = document.querySelectorAll(".xend-ext-dashboard-buy-price");
            let sellPrices: any = document.querySelectorAll(".xend-ext-dashboard-sell-price");
            let amt = Number(e.target.value);
            let prices = null;
            if (mode == "xend") {
                // @ts-ignore
                prices = await getXendPrice(state.keys[idx]["xend"].address, amt, showDashboardModal);
            } else {
                // @ts-ignore
                prices = await getFriendTechPrice(state.keys[idx]["friendtech"].address, amt, showDashboardModal);
            }
            // @ts-ignore
            buyPrices[idx].innerHTML = (Number(prices?.buyPrice)).toFixed(5);
            // @ts-ignore
            sellPrices[idx].innerHTML = (Number(prices?.sellPrice)).toFixed(5);
        });
    });
    // @ts-ignore
    document.querySelectorAll(".xend-ext-dashboard-keys-buy").forEach((el: any, idx: any) => {
        el.addEventListener("click", async (e: any) => {
            if (isPendingKeysBuy && isPendingKeysSell) {
                return;
            }

            console.log("xend-ext-dashboard-keys-buy");

            isPendingKeysBuy = true;

            // @ts-ignore
            el.classList.add("spinner-button-loading");
            // @ts-ignore
            el.disabled = true;

            let amounts: any = document.querySelectorAll(".xend-ext-dashboard-keys-input");
            let amt = Number(amounts[idx].value);
            if (amt == null || amt == 0) {
                // @ts-ignore
                el.disabled = false;
                // @ts-ignore
                el.classList.remove("spinner-button-loading");
                isPendingKeysBuy = false;
                
                showDashboardModal("Alert", "Please input positive value.");
                return;
            }

            let toolSets: any = document.querySelectorAll(".xend-ext-dashboard-keys-toolset");
            let mode: any = toolSets[idx].dataset.mode;

            console.log("Keys Buy: ", mode, state.keys[idx], idx);
            // @ts-ignore
            let addr = state.keys[idx][mode].address;

            if (mode == "xend") {
                buyXendKey(el, addr, amt, refreshKeysPage, showDashboardModal, setIsPendingKeysBuy);
            } else {
                buyFriendTechKey(el, addr, amt, refreshKeysPage, showDashboardModal, setIsPendingKeysBuy);
            }
        });
    });
    // @ts-ignore
    document.querySelectorAll(".xend-ext-dashboard-keys-sell").forEach((el: any, idx: any) => {
        el.addEventListener("click", async (e: any) => {
            if (isPendingKeysBuy && isPendingKeysSell) {
                return;
            }

            console.log("xend-ext-dashboard-keys-sell");

            isPendingKeysSell = true;

            // @ts-ignore
            el.disabled = true;
            // @ts-ignore
            el.classList.add("spinner-button-loading");

            let amounts: any = document.querySelectorAll(".xend-ext-dashboard-keys-input");
            let amt = Number(amounts[idx].value);
            if (amt == null || amt == 0) {
                // @ts-ignore
                el.disabled = false;
                // @ts-ignore
                el.classList.remove("spinner-button-loading");
                isPendingKeysSell = false;
                showDashboardModal("Alert", "Please input positive value.");
                return;
            }

            let toolSets: any = document.querySelectorAll(".xend-ext-dashboard-keys-toolset");
            let mode: any = toolSets[idx].dataset.mode;
            // @ts-ignore
            let addr = state.keys[idx][mode].address;

            if (mode == "xend") {
                sellXendKey(el, addr, amt, refreshKeysPage, showDashboardModal, setIsPendingKeysSell);
            } else {
                sellFriendTechKey(el, addr, amt, refreshKeysPage, showDashboardModal, setIsPendingKeysSell);
            }
        });
    });
    // @ts-ignore
    document.querySelectorAll(".xend-ext-dashboard-keys-row").forEach((el: any, idx: any) => {
        el.addEventListener("click", async (e: any) => {
            let toolSets: any = document.querySelectorAll(".xend-ext-dashboard-keys-toolset");
            let arrows: any = document.querySelectorAll(".xend-ext-keys-direction");
            // @ts-ignore
            if (idx != currentSelectedKeyIdx) {
                if (currentSelectedKeyIdx != null) {
                    toolSets[currentSelectedKeyIdx].style.display = "none";
                }
                toolSets[idx].style.display = "flex";
                currentSelectedKeyIdx = idx;
                arrows[idx].classList.remove("xend-ext-keys-arrow-down");
                arrows[idx].classList.add("xend-ext-keys-arrow-up");
            } else {
                currentSelectedKeyIdx = null;
                toolSets[idx].style.display = "none";
                arrows[idx].classList.remove("xend-ext-keys-arrow-up");
                arrows[idx].classList.add("xend-ext-keys-arrow-down");
            }
        })
    });
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

            for (let i = numOfKeys; i < state.keys.length; i++) {
                // @ts-ignore
                keys.push({ ...state.keys[i] });
                if (keys.length == state.keysPageInfo.pageSize) {
                    break;
                }
            }

            const content = getKeyArray({ keys });

            // @ts-ignore
            document.getElementById("xend-ext-dashboard-row-container").innerHTML += content; 
            // @ts-ignore
            document.getElementById("xend-ext-dashboard-row-container").scrollTop = scrollTop;

            state.loadingArticles = false;
        }
    });
}

function createLogin(node: any) {
    console.log("createLogin");

    const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
    const para = document.getElementsByTagName("body");
    // @ts-ignore
    const compStyles = window.getComputedStyle(para[0]);

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
    const para = document.getElementsByTagName("body");
    // @ts-ignore
    const compStyles = window.getComputedStyle(para[0]);
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
    console.log("createSignUp");

    const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
    const para = document.getElementsByTagName("body");
    // @ts-ignore
    const compStyles = window.getComputedStyle(para[0]);
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
    <button id="xend-ext-signup-btn" class="spinner-button">
        <span class="spinner-button-text">Sign up</span>
    </button>
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
    console.log("createDashboard");

    const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
    const para = document.getElementsByTagName("body");
    // @ts-ignore
    const compStyles = window.getComputedStyle(para[0]);
    const darkModeStyle = compStyles.backgroundColor == 'rgb(255, 255, 255)' ? false : true;

    node.style.height = '410px';
    node.style.position = "relative";
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
            ` + getKeys({ ...state.key, keys: state.keys }) + ` 
            </div>
            
            <div id="content-3">
                <div class="xend-ext-dashboard-profile">
                    <textarea id="xendExtPostContent" placeholder="What's on your mind?"></textarea>
                    <div class="xend-ext-dashboard-profile-file" title="Upload file"><label title="Add Image"><input id="addFile" type="file" /></label><button title="Remove Image" id="removeFile">&times;</button></div>
                    <button id="xend-ext-dashboard-profile-post" class="spinner-button">
                        <span class="spinner-button-text">Post</span>
                    </button>
                    <div style="clear: both"></div>
                </div>
                <div id="xend-ext-dashboard-profile-articles"> ` + getArticles(container, state.user.articles) + `</div>
            </div>
            
            <div id="content-4">
                <iframe src="https://www.friend.tech/"></iframe>
            </div>
            
            <div class="tabs__links">
                <a href="#content-1" class="xend-ext-dashboard-header-tab"><div></div>Feed<span></span></a>
                <a href="#content-2" class="xend-ext-dashboard-header-tab"><div></div>Keys<span></span></a>
                <a href="#content-3" class="xend-ext-dashboard-header-tab"><div></div>Profile<span></span></a>
                <a href="#content-4" class="xend-ext-dashboard-header-tab"><div></div>FT<span></span></a>
            </div>
        </div>    
        <div id="dashboardModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <div class="modal-icon"></div>
                    <p id="dashboardModalHeaderTxt" class="modal-header-text">Wrong wallet</p>
                </div>
                <p id="dashboardModalMainTxt" class="modal-main-text">
                    Connect your paired XEND wallet, 0x1041...3234 to continue.
                </p>
                <button id="dashboardModalCloseBtn" class="modal-close-button">Close</button>
            </div>
        </div>
    `;
    container.innerHTML = pageTpl;

    const aside = node.getElementsByTagName('aside')[0];
    aside.replaceChildren(aside.children[0]);
    aside.getElementsByTagName('div')[0].appendChild(container);

    // @ts-ignore
    container.querySelector("#dashboardModal").style.display = "none";
    // @ts-ignore
    container.querySelector("#dashboardModalCloseBtn").addEventListener("click", (e) => {
        // @ts-ignore
        container.querySelector("#dashboardModal").style.display = "none";
    });
    // @ts-ignore
    container.querySelector("#xend-ext-dashboard-warning").style.visibility = "hidden";
    // @ts-ignore
    container.querySelector('a[href="#content-1"]').addEventListener("click", (e) => {
        console.log("Show Feed Page");
        e.preventDefault();
        updateFeedPage();
    });
    // @ts-ignore
    container.querySelector('a[href="#content-2"]').addEventListener("click", (e) => {
        e.preventDefault();

        refreshKeysPage();

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
            // @ts-ignore
            let pid = e.target.dataset.pid;
            // @ts-ignore
            let uid = e.target.dataset.uid;
            port = chrome.runtime.connect({name: "authorize"});
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
                    state.user.articles = msg.articles;
                    state.user.articleCount = msg.count;
                    state.user.currentRange = msg.start;

                    updateProfilePage();

                    chrome.storage.local.set({ state });
                }
            });
        }
    });

    const updateSettingsPage = async () => {
        try {
            const prov = await getProvider();
            const provider = new ethers.providers.Web3Provider(prov);
    
            const [accounts, chainId] = await getAccounts(prov);

            if (chainId != chain) {
                showSettingModal("Alert", "Please switch to Ethereum Mainnet");
                switchChainEth(prov);
                return;
            }

            signer = provider.getSigner();
            subscribeContract = new ethers.Contract(subscribeAddress, subscribeABI, provider);
    
            const isEnabled = await subscribeContract.connect(signer)["isMonthlySubscriptionEnabled"](state.user.address);
            const price = await subscribeContract.connect(signer)["monthlySubPrice"](state.user.address);
            state.user.subscribePriceInETH = Web3.utils.fromWei(parseInt(price._hex).toString(), "ether");
            state.user.isSubscriptionEnabled = isEnabled;

            port = chrome.runtime.connect({name: "authorize"});
            port.postMessage({
                task: "getCompatibility",
                uid: state.user.uid,
                token: state.token,
                secret: state.secret
            });

            port.onMessage.addListener(function(msg) {
                if (msg.result === "successGetCompatibility") {
                    // @ts-ignore
                    document.getElementById("xendExtFriendTechCheckbox").checked = msg.isCompatibility;

                    state.user.isCompatibility = msg.isCompatibility;

                    chrome.storage.local.set({ state });
        
                    // @ts-ignore
                    document.getElementById("xendExtSettingsPrice").innerHTML = `${state.user.subscribePriceInETH} ETH`;
                    // @ts-ignore
                    document.getElementById("xendExtSubscriptionPrice").value = state.user.subscribePriceInETH;
                    // @ts-ignore
                    document.getElementById("xendExtSubscriptionCheckbox").checked = isEnabled;
                    // @ts-ignore
                    document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "none";
                    // @ts-ignore
                    document.querySelector('aside[xend="settings"]').parentNode.parentNode.style.display = "";
                }
            });
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

        addOverLayToImages();
        // @ts-ignore
        container.querySelectorAll(".xend-ext-comment a").forEach(el => {
            el.addEventListener("click", e => {
                e.preventDefault();
                // @ts-ignore
                const content = e.target.previousElementSibling.value.trim();
                // @ts-ignore
                const pid = e.target.dataset.pid;
                port = chrome.runtime.connect({name: "authorize"});
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
                        state.user.articles = msg.articles;                        
                        updateProfilePage();
                        chrome.storage.local.set({ state });
                    }
                });
            });
        });
    }

    // @ts-ignore
    container.querySelector('a[href="#content-3"]').addEventListener("click", (e) => {
        e.preventDefault();
        port = chrome.runtime.connect({name: "authorize"});
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
                // @ts-ignore
                state.user.articleCount = msg.count;
                state.user.currentRange = 0;
                state.user.articles = msg.articles;

                updateProfilePage();
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
    container.querySelector("#xend-ext-dashboard-profile-post").addEventListener("click", e => {
        disablePost();

        // @ts-ignore
        const content = document.querySelector("#xendExtPostContent").value.trim();
        port = chrome.runtime.connect({name: "authorize"});
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
                console.log("successPostArticle");
                state.user.articleCount = msg.count;
                state.user.articles = msg.articles;
                state.user.currentRange = msg.start;

                // @ts-ignore
                container.querySelector("#xendExtPostContent").value = "";

                enablePost();

                updateProfilePage();
    
                chrome.storage.local.set({ state });
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
            if (state.user.articleCount == state.user.articles.length) {
                return;
            }

            state.loadingArticles = true;
            // @ts-ignore
            const scrollTop = document.querySelector("#xend-ext-dashboard-profile-articles").scrollTop;
            const numOfArticles = document.querySelectorAll("#xend-ext-dashboard-profile-articles .xend-ext-dashboard-row").length;
            port = chrome.runtime.connect({name: "authorize"});
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
                    if (msg.articles.length == 0) {
                        state.loadingArticles = false;
                        return;
                    }
                    if (state.user.articleCount == state.user.articles.length) {
                        state.loadingArticles = false;
                        return;
                    }
                    // @ts-ignore
                    msg.articles.forEach(article => {
                        let isExist = false;
                        for (let i = 0; i < state.user.articles.length; i++) {
                            // @ts-ignore
                            if (state.user.articles[i].postID == article.postID) {
                                isExist = true;
                                break;
                            }
                        }
                        
                        if (!isExist) {
                            // @ts-ignore
                            state.user.articles.push(article);
                        }
                    });
            
                    updateProfilePage();

                    // @ts-ignore
                    document.querySelector("#xend-ext-dashboard-profile-articles").scrollTop = scrollTop;
                    state.loadingArticles = false;
                    chrome.storage.local.set({ state });
                }
            });

        }
    });
}

function createProfileMenu(node: any) {
    console.log("createProfileMenu");

    const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
    const para = document.getElementsByTagName("body");
    // @ts-ignore
    const compStyles = window.getComputedStyle(para[0]);
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
                    <button id="xend-ext-menu-friendtech" class="xend-ext-menu-switch-platform">
                        <div></div>
                    </button>
                    <button id="xend-ext-menu-xend" class="xend-ext-menu-switch-platform switch-xend-focus">                
                        <div></div>
                    </button>
                </div>
                <div class="xend-ext-menu-key">
                    <input type="number" value="0" id="xend-ext-menu-key-input" class="xend-ext-menu-key-value" />
                    <div class="xend-ext-menu-trade">
                        <div class="xend-ext-menu-btn-set">
                            <button id="xend-ext-menu-key-buy" class="spinner-button">
                                <span class="spinner-button-text">Buy</span>
                            </button>
                            <div class="xend-ext-menu-key-price">
                                <div class="xend-ext-menu-key-currency"></div>
                                <span id="xend-ext-menu-key-buy-price">0</span>
                            </div>
                        </div>
                        <div class="xend-ext-menu-btn-set">
                            <button id="xend-ext-menu-key-sell" class="spinner-button">
                                <span class="spinner-button-text">Sell</span>
                            </button>
                            <div class="xend-ext-menu-key-price">
                                <div class="xend-ext-menu-key-currency"></div>
                                <span id="xend-ext-menu-key-sell-price">0</span>
                            </div>
                        </div>
                    </div>
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
    container.querySelector("#xend-ext-menu-friendtech").addEventListener("click", async (e) => {
        port = chrome.runtime.connect({name: "authorize"});
        port.postMessage({
            task: "getMyFriendTechInfo",
            name: state.user.name
        });
        port.onMessage.addListener(async function(msg: any) {
            if (msg.result === "successGetMyFriendTechInfo") {
                if (!msg.address) {
                    showBuySellModal("Alert", "You don't have account in Friend Tech Platform.");
                    return;
                }

                let provider = await getProvider();
                switchChainBase(provider);

                state.user.friendtechAddress = msg.address;

                chrome.storage.local.set({ state });

                try {
                    // @ts-ignore
                    document.querySelector("#xend-ext-menu-xend").classList.remove("switch-xend-focus");
                    // @ts-ignore
                    document.querySelector("#xend-ext-menu-friendtech").classList.add("switch-friendtech-focus");
                } catch (error) {

                }

                updateBuySellPageFriendTech();
            }
        });
    });

    // @ts-ignore
    container.querySelector("#xend-ext-menu-xend").addEventListener("click", (e) => {
        // @ts-ignore
        container.querySelector("#xend-ext-menu-up-trend-wrapper").style.display = "";
        
        let path = window.location.href;
        const prefix = "https://twitter.com/";
        path = path.slice(path.indexOf(prefix) + prefix.length, path.length);
        
        port.postMessage({
            task: "getKeyInfo",
            keyOwnerName: path,
            token: state.token,
            secret: state.secret,
            uid: state.user.uid
        });

        port.onMessage.addListener(async function(msg: any) {
            if (msg.result === "successGetKeyInfo") {
                if (msg.data.result == "error") {
                    console.log("successGetKeyInfo Error");
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
                    
                    isPendingBuy = false;
                    isPendingSell = false;

                    try {
                        // @ts-ignore
                        document.querySelector("#xend-ext-menu-xend").classList.add("switch-xend-focus");
                        // @ts-ignore
                        document.querySelector("#xend-ext-menu-friendtech").classList.remove("switch-friendtech-focus");
                    } catch (error) {

                    }

                    chrome.storage.local.set({ state });

                    let provider = await getProvider();
                    switchChainEth(provider);

                    updateBuySellPageXend();
                }
            }
        });
    });
};

function createSettings(node: any) {
    console.log("createSettings");

    const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
    const para = document.getElementsByTagName("body");
    // @ts-ignore
    const compStyles = window.getComputedStyle(para[0]);
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
        port = chrome.runtime.connect({name: "authorize"});
        // @ts-ignore
        port.postMessage({
            task: "setFriendTechCompatibility",
            isCompatible: e.target.checked,
            uid: state.user.uid,
            token: state.token,
            secret: state.secret
        });
        // @ts-ignore
        port.onMessage.addListener(async function(msg: any) {
            if (msg.result === "successSetCompatibility") {
                if (msg.status) {
                    state.user.isCompatibility = e.target.checked;
                    chrome.storage.local.set({ state });
                }
            }
        });
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
        price = Number(price);
        if (price <= 0 || price > 100) {
            isPendingUpdatePrice = false;
            // @ts-ignore
            document.getElementById("xendExtSubscriptionUpdate").classList.remove("spinner-button-loading");
            // @ts-ignore
            document.getElementById("xendExtSubscriptionUpdate").disabled = false;
            showSettingModal("Alert", "Please input positive value less than 100.");
            return;
        }
        let priceInETH = price;

        price = Web3.utils.toWei(price.toString(), "ether");
        console.log(price);

        const provider = await getProvider();
        const prov = new ethers.providers.Web3Provider(provider);
    
        const [accounts, chainId] = await getAccounts(provider);
        const account = getNormalizeAddress(accounts);
    
        if (account.toLowerCase() != state.user.address.toLowerCase()) {
            // @ts-ignore
            document.getElementById("xendExtSubscriptionUpdate").disabled = false;
            // @ts-ignore
            document.getElementById("xendExtSubscriptionUpdate").classList.remove("spinner-button-loading");
            setIsPendingUpdatePrice(false);
            showWarningMessage("Wrong wallet connected on Metamask");
            showSettingModal("Wrong Wallet.", `Connect your paired Xend wallet, ${getShortHash(state.user.address)} to continue.`);
            return;
        }
    
        if (chainId != chain) {
            // @ts-ignore
            document.getElementById("xendExtSubscriptionUpdate").disabled = false;
            // @ts-ignore
            document.getElementById("xendExtSubscriptionUpdate").classList.remove("spinner-button-loading");
            setIsPendingUpdatePrice(false);
            showWarningMessage("Wrong chain selected on Metamask");
            showSettingModal("Alert.", "Please switch chain to Ethereum Mainnet.");
            return;
        }
    
        hideWarningMessage();
    
        let signer = prov.getSigner();

        subscribeContract = new ethers.Contract(subscribeAddress, subscribeABI, prov);
        
        // @ts-ignore
        const isChecked = document.getElementById("xendExtSubscriptionCheckbox").checked;

        try {
            const result = await subscribeContract.connect(signer)["setCreatorSubscriptionSettings"](price, isChecked);
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
                    state.user.subscribePriceInETH = priceInETH;
                    state.user.isSubscriptionEnabled = isChecked;
                    chrome.storage.local.set({ state });
                    // @ts-ignore
                    document.getElementById("xendExtSettingsPrice").innerHTML = `${state.user.subscribePriceInETH} ETH`;
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
            // @ts-ignore
            if (error.code == "ACTION_REJECTED") {
                showSettingModal("Alert!", "You have rejected Transaction.");
            } else {
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
    console.log("checkURL", isStart);

    if (isStart) {
        // @ts-ignore
        document.querySelector('aside[xend="settings"]').parentNode.parentNode.style.display = "none";
        // @ts-ignore
        document.querySelector('aside[xend="profile"]').parentNode.parentNode.style.display = "none";
        // @ts-ignore
        document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "none";
    }

    updateFeedPage();
    
    let path = window.location.href;
    const prefix = "https://twitter.com/";
    path = path.slice(path.indexOf(prefix) + prefix.length, path.length);
    
    port.postMessage({
        task: "getKeyInfo",
        keyOwnerName: path,
        token: state.token,
        secret: state.secret,
        uid: state.user.uid
    });

    port.onMessage.addListener(async function(msg: any) {
        if (msg.result === "successGetKeyInfo") {
            console.log("successGetKeyInfo Load: ", msg.data);
            if (msg.data.result != "error" && msg.data.data) {
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
                
                chrome.storage.local.set({ state });

                await updateBuySellPageXend();

                if (state.walletConnected && state.authorized && state.signedUp) {
                    // @ts-ignore
                    document.querySelector('aside[xend="profile"]').parentNode.parentNode.style.display = "";
                    // @ts-ignore
                    document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "";
                }
            } else {
                if (state.walletConnected && state.authorized && state.signedUp) {
                    // @ts-ignore
                    document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "";
                }
            }

            if (isStart && state.walletConnected && state.authorized && state.signedUp) {
                const provider = await getProvider();
                const prov = new ethers.providers.Web3Provider(provider);
                
                const [accounts, chainId] = await getAccounts(provider);
                const account = getNormalizeAddress(accounts);

                if (account.toLowerCase() != state.user.address.toLowerCase()) {
                    showWarningMessage("XEND wallet not selected on Metamask");
                }
            }
        }
    });
}

///////////////////////////////////////////////////////////////////////////////////////
const onMutation = async (mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            const nodes = traverseAndFindAttribute(node, 'aside');
            // @ts-ignore
            nodes.forEach((n: any) => {
                const sidebar = n.parentElement.parentElement.parentElement;

                getState(async () => {
                    console.log("=== Get State ===");
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

                    await checkURL(true);

                    walletProvider = await getProvider();
                    // @ts-ignore
                    walletProvider.on('accountsChanged', async function (accounts) {
                        // Time to reload your interface with accounts[0]!
                        console.log(accounts);
                        if (state.user.address) {
                            if (state.user.address != accounts[0]) {
                                showWarningMessage("XEND wallet not selected on Metamask");
                            } else {
                                hideWarningMessage();
                            }
                        }
                    });
                    // // @ts-ignore
                    // walletProvider.on('connect', async function (connectInfo) {
                    //     // Time to reload your interface with the new networkId
                    //     let chainId = parseInt(connectInfo.chainId, 16);
                    //     console.log(chainId);
                    //     if (chainId != chain) {
                    //         let res = await switchChainEth(walletProvider);
                    //         if (!res) {
                    //             logout();
                    //         }
                    //     }
                    // });
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