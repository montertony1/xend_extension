import { MetaMaskInpageProvider, createExternalExtensionProvider } from "@metamask/providers";
import { ethers } from 'ethers';
import React, { useEffect, useState } from 'react';
import walletUpdate from './wallet-update.png';
import walletConnect from './wallet-connect.png';
import wideLogo from './xend-small.png';

import linkLogo from './link.png';
import './App.css';

const App = () => {

  const [isLoaded, setLoaded] = useState(false);
  const [isSettings, setToSettings] = useState(false);

  const [user, setLoggedIn] = useState({
    uid: undefined,
    name: undefined,
    handle: undefined,
    pfp: undefined,
    address: undefined,
  });

  function truncateEthAddress(address: string) {
    if (address.length < 10) return address;
    const first6Chars = address.substring(0, 6);
    const last4Chars = address.slice(-4);
    const truncatedAddress = `${first6Chars}....${last4Chars}`;
    return truncatedAddress;
  }

  const logout = async () => {
    chrome.storage.sync.clear();
    setLoggedIn({ uid: undefined, name: undefined, handle: undefined, pfp: undefined, address: undefined });
  };

  const login = async () => {
    chrome.runtime.sendMessage({ type: 'login' });
  };

  const updateWallet = async () => {
    const regex = /(0x[a-f0-9]{40})/g;
    let addressValue = (document.getElementById('ethAddress') as HTMLInputElement).value;
    addressValue = addressValue.toLowerCase().trim();

    if (addressValue !== '' && regex.test(addressValue)) {
      chrome.storage.sync.get('access_token').then((data) => {
        const params = data.access_token;
        params.address = addressValue;
        console.log(params);
        fetch(`http://localhost:3001/set_address`, {
          method: 'POST',
          body: JSON.stringify(params),
          headers: { 
              'Content-Type': 'application/json', 
              'Accept': 'application/json'
          }
        })
        .then(() => {
            setLoggedIn({ uid: user.uid, name: user.name, handle: user.handle, pfp: user.pfp, address: addressValue as any });
        });
      });
    }
  };

  const showMyContent = async () => {
    setToSettings(false);

    // if content creator
    let provider = createExternalExtensionProvider();
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    console.log(accounts)

  };

  const showSettings = async () => {
    setToSettings(true);

  };

  useEffect(() => {
    chrome.storage.sync.get('user').then((data) => {
      const user = data.user;

      if (user) {
        fetch(`http://localhost:3001/get_address/` + user.uid, {
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json'}
        })
        .then(response => response.json())
        .then((address) => {
            setLoggedIn({ uid: user.uid, name: user.name, handle: user.handle, pfp: user.pfp, address: address.address });
        });
      } else {
        chrome.storage.sync.get('access_token').then((accessToken) => {
          if (accessToken) {
            // fetch data
          } else {
            // login
          }
        });
      }
    });

  }, []);

  return user.uid === undefined ?
    (
    <header className="App-header">
      <img src={wideLogo} className="App-logo" alt="tipxLogoSquare" />
      <button className='Button-rounded' onClick={() => login() }>Login with X</button>
    </header>
    )
    :
    (
    <div className="App">
      <div className='Header-img'>
        <img src={wideLogo} alt="tipxLogoSquare" className='Wide-logo' />
      </div>
      <div className="User-container">
        <div className="User-item">
          {user.pfp !== undefined ? 
            <img src={user.pfp} className="Img-rounded Item-content" alt="pfp"/>
            :
            <img className="Img-rounded Item-content" alt="pfp" style={{backgroundColor: '#fff'}}/>
          }
          <div className='User-column'>
            <div>@{user.handle}</div>
                {user.address === undefined ? 
                <div style={{color: '#666666', display: 'flex', alignItems: 'center'}}>
                  Connect wallet
                  <button className='Wallet-update' onClick={() => logout() }>
                    <img draggable='false' src={walletConnect} className='Wallet-img' alt="Connect wallet"/>
                  </button>
                </div>
                :
                <div style={{color: '#666666', display: 'flex', alignItems: 'center'}}>
                  {truncateEthAddress(user.address)}
                  <button className='Wallet-update' onClick={() => logout() }>
                    <img draggable='false' src={walletUpdate} className='Wallet-img' alt="Update wallet"/>
                  </button>
                </div>
              }
          </div>
        </div>
        <div className="User-item">
          <button className='Button-rounded Button-logout' onClick={() => logout() }>Logout</button>
        </div>
      </div>
      
      {/*     Menu     */}
      <div className="Menu">
        <button id='mycontent-button' className={"Menu-button Menu-button-" + (isSettings ? 'unselected': 'selected')} onClick={showMyContent}>
          My Content
          <div className={"Menu-underline Menu-underline-" + (isSettings ? 'unselected': 'selected')}></div>
        </button>
        <button id='settings-button' className={"Menu-button Menu-button-" + (isSettings ? 'selected' : 'unselected')} onClick={showSettings}>
          Settings
          <div className={"Menu-underline Menu-underline-" + (isSettings ? 'selected' : 'unselected')}></div>
        </button>
      </div>

      <hr/>

      {/* Content */}
      { 
      isSettings ? 
      <div className="Settings-input-container">
        <span className="Settings-input-text-left">LIFETIME</span>
        <input type="text" className="Settings-input" maxLength={7} defaultValue={'0.3'}/>
        <span className="Settings-input-text-right">ETH</span>
      </div>
      :
      <div className="Dynamic-list-container">
        <ul className="Dynamic-list">
          <li className='List-container'>
            <div>
              <div className='List-from'>
                From <a href={'https://x.com/'} target='_blank' rel="noreferrer">@elonmusk</a>
                <a className='Link-button' target='_blank' rel="noreferrer" href='https://etherscan.io/tx/'>
                  <img draggable='false' src={linkLogo} className='Link-img' alt="logout"/>
                </a>
              </div>
              <div className='List-message'>
                Come to brazil  
              </div>
            </div>
            <div className='List-value'>
              0.69 ETH
            </div>
          </li>
        </ul>
      </div> 
      }

    </div>
  );
}

export default App;