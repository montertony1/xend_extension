import { MetaMaskInpageProvider, createExternalExtensionProvider } from "@metamask/providers";
import { Contract, Provider, ethers } from "ethers";
import logo from "./xend-small.png";
import metamaskLogo from "./metamask.png";

const logoW = chrome.runtime.getURL("/static/img/xend-small-white.png");
const logoB = chrome.runtime.getURL("/static/img/xend-small-black.png");
const avatarImg = chrome.runtime.getURL("/static/img/avatar.png");
const styleList = chrome.runtime.getURL("/static/css/style.css");

let state = {
    loggedIn: false,
    authorized: false,
    walletConnected: false,
    user: {
        avatar: avatarImg,
        name: "@elonmusk"
    }
};

const user = {
    pfp: 'https://pbs.twimg.com/profile_images/1606815745215791105/IX8pacjk_400x400.jpg'
}

interface IWeb3 {  
    ethereum?: MetaMaskInpageProvider;
    contract?: Contract;
};

interface User {
    uid: string | undefined;
    name: string | undefined;
    handle: string | undefined;
    pfp: string | undefined;
    address: string | undefined;
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
      ) {
        if (node.parentElement.parentElement.parentElement.children.length > 1) {
            console.log('aside found');
            console.log(node)
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
    state.authorized = true;
    chrome.storage.local.set({
        state: state
    });
    if (state.authorized
        && document.querySelector('aside[xend="wallet"]')
        // @ts-ignore
        && document.querySelector('aside[xend="wallet"]').parentNode.parentNode.style.display == "none"
    ) {
        // @ts-ignore
        document.querySelector('aside[xend="login"]').parentNode.parentNode.style.display = "none";
        // @ts-ignore
        document.querySelector('aside[xend="wallet"]').parentNode.parentNode.style.display = "";
    }
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

function connectWallet() {
    state.walletConnected = true;
    chrome.storage.local.set({
        state: state
    });
    if (state.authorized && state.walletConnected
        && document.querySelector('aside[xend="dashboard"]')
        // @ts-ignore
        && document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display == "none"
    ) {
        // @ts-ignore
        document.querySelector('aside[xend="wallet"]').parentNode.parentNode.style.display = "none";
        // @ts-ignore
        document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "";
    }
}

function logout() {
    state.authorized = false;
    state.walletConnected = false;
    chrome.storage.local.set({
        state: state
    });
    if (!state.authorized && !state.walletConnected
        && document.querySelector('aside[xend="dashboard"]')
        && document.querySelector('aside[xend="profile"]')
        // @ts-ignore
        && document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display == ""
    ) {
        // @ts-ignore
        document.querySelector('aside[xend="dashboard"]').parentNode.parentNode.style.display = "none";
        // @ts-ignore
        document.querySelector('aside[xend="profile"]').parentNode.parentNode.style.display = "none";
        // @ts-ignore
        document.querySelector('aside[xend="login"]').parentNode.parentNode.style.display = "";
    }
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
    container.classList.add("xend-ext-container");
    if (darkMode.matches || darkModeStyle) {
        container.classList.add("xend-ext-dark");
    } else {
        container.classList.add("xend-ext-white");
        // @ts-ignore
        document.querySelector(':root').style.setProperty('--xendwhite', '#333333');
    }

    const pageTpl = `
    <img class="xend-ext-wallet-avatar" src="${state.user.avatar}" alt="avatar" draggable="false" />
    <div class="xend-ext-wallet-user">${state.user.name}</div>
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

function createDashboard(node: any) {
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
    const para = document.querySelector("body");
    // @ts-ignore
    const compStyles = window.getComputedStyle(para);
    const darkModeStyle = compStyles.backgroundColor == 'rgb(255, 255, 255)' ? false : true;

    node.style.height = '410px';
    if (!state.authorized || !state.walletConnected) {
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
        <button id="xend-ext-dashboard-settings-btn"></button>
    </div>
    
<div class="tabs">
  <div id="content-1" class="selected">
    
    <div class="xend-ext-dashboard-row">
      <div class="xend-ext-dashboard-column-left"> 
        <div class="xend-ext-dashboard-news">
            <img class="xend-ext-dashboard-news-logo" src="${state.user.avatar}" alt="avatar" draggable="false" />
            <div class="xend-ext-dashboard-news-user">@elonmusk</div>
            <div class="xend-ext-dashboard-news-time">13h ago</div>
        </div>
        <div class="xend-ext-dashboard-news-title">
        Sold 500k doge to buy 420 @tesla keys
        </div>
      </div>
      <div class="xend-ext-dashboard-column-right">
        <img class="xend-ext-dashboard-avatar" src="${state.user.avatar}" alt="avatar" draggable="false" />
      </div>
      <div style="clear: both"></div>
    </div>
    
    <div class="xend-ext-dashboard-row">
      <div class="xend-ext-dashboard-column-left"> 
        <div class="xend-ext-dashboard-news">
            <img class="xend-ext-dashboard-news-logo" src="${state.user.avatar}" alt="avatar" draggable="false" />
            <div class="xend-ext-dashboard-news-user">@LewisHamilton</div>
            <div class="xend-ext-dashboard-news-time">15h ago</div>
        </div>
        <div class="xend-ext-dashboard-news-title">
        Crashing on lap 50, place your bets
        </div>
      </div>
      <div class="xend-ext-dashboard-column-right">
        <img class="xend-ext-dashboard-avatar" src="${state.user.avatar}" alt="avatar" draggable="false" />
      </div>
      <div style="clear: both"></div>
    </div>
    
  </div>

  <div id="content-2">
    <div class="xend-ext-dashboard-keys">
        <img class="xend-ext-dashboard-keys-logo" src="${state.user.avatar}" alt="avatar" draggable="false" />
        <div class="xend-ext-dashboard-keys-col">
            Keys
            <div>123</div>
        </div>
        <div class="xend-ext-dashboard-keys-col">
            Holders
            <div>95</div>
        </div>
        <div class="xend-ext-dashboard-keys-col xend-ext-dashboard-keys-col-price">
            Price
            <div>0.0012</div>
        </div>
    </div>
    
    <div class="xend-ext-dashboard-row xend-ext-dashboard-mykeys">
      <div class="xend-ext-dashboard-column-left"> 
        <div class="xend-ext-keys-header">
            My Keys
        </div>
      </div>
      <div class="xend-ext-dashboard-column-right">
        22.062
      </div>
      <div style="clear: both"></div>
    </div>
    
    <div class="xend-ext-dashboard-row">
      <div class="xend-ext-dashboard-column-left">         
            <img class="xend-ext-dashboard-keys-logo" src="${state.user.avatar}" alt="avatar" draggable="false" />
            <div class="xend-ext-dashboard-keys-user">
            @elonmusk
            <div>0.441</div>
            </div>
      </div>
      <div class="xend-ext-dashboard-column-right">
        <div class="xend-ext-keys-value">
            50
            <div>
                22.05    
            </div>
        </div>
      </div>
      <div style="clear: both"></div>
    </div>
    
    <div class="xend-ext-dashboard-row">
      <div class="xend-ext-dashboard-column-left">         
            <img class="xend-ext-dashboard-keys-logo" src="${state.user.avatar}" alt="avatar" draggable="false" />
            <div class="xend-ext-dashboard-keys-user">
            @LewisHamilton
            <div>0.001</div>
            </div>
      </div>
      <div class="xend-ext-dashboard-column-right">
        <div class="xend-ext-keys-value">
            12
            <div>
                0.012    
            </div>
        </div>
      </div>
      <div style="clear: both"></div>
    </div>
    
  </div>


  <div id="content-3">
    <div class="xend-ext-dashboard-profile">
        <textarea>So nice i had to post it twice</textarea>
        <div class="xend-ext-dashboard-profile-file"></div>
        <button id="xend-ext-dashboard-profile-post">
            Post
        </button>
        <div style="clear: both"></div>
    </div>
    
     <div class="xend-ext-dashboard-row">
      <div class="xend-ext-dashboard-column-left"> 
        <div class="xend-ext-dashboard-news">
            <div class="xend-ext-dashboard-news-time" style="padding-left: 0;">19h ago</div>
            <div class="xend-ext-profile-del">Delete</div>
        </div>
        <div class="xend-ext-dashboard-news-title" style="word-wrap: break-word;">
        Buy $elondoge now ca:
        0xe28b3B32B6c345A34Ff64674606124Dd5Aceca30
        </div>
      </div>
      <div class="xend-ext-dashboard-column-right">
        <img class="xend-ext-dashboard-avatar" src="${state.user.avatar}" alt="avatar" draggable="false" style="margin-top: 18px;" />
      </div>
      <div style="clear: both"></div>
    </div>
    
  </div>

  <div class="tabs__links">
    <a href="#content-1">Feed</a>
    <a href="#content-2">Keys</a>
    <a href="#content-3">Profile</a>
   
  </div>
</div>    
    `;
    container.innerHTML = pageTpl;

    const aside = node.getElementsByTagName('aside')[0];
    aside.replaceChildren(aside.children[0]);
    aside.getElementsByTagName('div')[0].appendChild(container);

    // @ts-ignore
    container.querySelector('a[href="#content-1"]').addEventListener("click", (e) => {
        e.preventDefault();
        // @ts-ignore
        container.querySelector('#content-1').classList.add("selected");
        // @ts-ignore
        container.querySelector('#content-2').classList.remove("selected");
        // @ts-ignore
        container.querySelector('#content-3').classList.remove("selected");
    });
    // @ts-ignore
    container.querySelector('a[href="#content-2"]').addEventListener("click", (e) => {
        e.preventDefault();
        // @ts-ignore
        container.querySelector('#content-2').classList.add("selected");
        // @ts-ignore
        container.querySelector('#content-1').classList.remove("selected");
        // @ts-ignore
        container.querySelector('#content-3').classList.remove("selected");
    });
    // @ts-ignore
    container.querySelector('a[href="#content-3"]').addEventListener("click", (e) => {
        e.preventDefault();
        // @ts-ignore
        container.querySelector('#content-3').classList.add("selected");
        // @ts-ignore
        container.querySelector('#content-1').classList.remove("selected");
        // @ts-ignore
        container.querySelector('#content-2').classList.remove("selected");

    });

    // @ts-ignore
    container.querySelector("#xend-ext-dashboard-settings-btn").addEventListener("click", e => {
        logout();
    });
}

const createProfileMenu = (node: any) => {
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
    const para = document.querySelector("body");
    // @ts-ignore
    const compStyles = window.getComputedStyle(para);
    const darkModeStyle = compStyles.backgroundColor == 'rgb(255, 255, 255)' ? false : true;

    node.style.height = '280px';
    if (!state.authorized || !state.walletConnected) {
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
        <img class="xend-ext-dashboard-keys-logo" src="${state.user.avatar}" alt="avatar" draggable="false" />
        <div class="xend-ext-menu-user">${state.user.name}</div>
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
                10
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


const onMutation = async (mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            const nodes = traverseAndFindAttribute(node, 'aside');
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

                    // Dashboard
                    const dashboardMenu = n.parentElement.parentElement.cloneNode(true);
                    createDashboard(dashboardMenu);
                    sidebar.insertBefore(dashboardMenu, sidebar.children[2]);

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
