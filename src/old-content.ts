import { MetaMaskInpageProvider, createExternalExtensionProvider } from "@metamask/providers";
import { Contract, Provider, ethers } from "ethers";

interface IWeb3 {  
    ethereum?: MetaMaskInpageProvider;
    contract?: Contract;
};


const traverseAndFindAttribute = (node: any, attribute: any): any => {
    let nodes = []
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.hasAttribute(attribute)) {
        nodes.push(node)
      }
    }
    for (const child of node.childNodes) {
      nodes = nodes.concat(traverseAndFindAttribute(child, attribute))
    }
    return nodes;
}

function addButton(node: any) {

}

const onMutation = (mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            const nodes = traverseAndFindAttribute(node, 'data-testid');
            nodes.forEach((n: any) => {
                const attrValue = n.getAttribute('data-testid');
                if (attrValue === 'UserProfileSchema-test') {
                    const user = document.querySelector('[data-testid="UserProfileSchema-test"]');
                    if (user) {
                        const uid = JSON.parse(user.innerHTML).author.identifier;
                        console.log(uid)
                        fetch(`http://localhost:3001/get_address/${uid}`, {
                            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json'}
                          })
                          .then(response => response.json())
                          .then((data) => {
                            if (document.querySelector('[data-testid="editProfileButton"]') || data.address === '') {
                                const ethButton = document.querySelector('[data-testid="sendETH"]');
                                const tokenButton = document.querySelector('[data-testid="sendTOKEN"]')
                                if (ethButton) ethButton.remove();
                                if (tokenButton) tokenButton.remove();
                                return;
                            }

                            const moreButton = document.querySelector('[data-testid="userActions"]');
                            const ethButton = moreButton?.cloneNode(true) as Element;
                            ethButton.setAttribute('data-testid', 'sendETH');
                            ethButton.addEventListener('click', async () => {
                                const provider = new ethers.BrowserProvider(createExternalExtensionProvider());
                                const signer = await provider.getSigner();
                                console.log(await signer.getAddress());
                                signer.sendTransaction({
                                    to: data.address,
                                    value: '0',
                                });
                            });

                            const tokenButton = moreButton?.cloneNode(true) as Element;
                            tokenButton.setAttribute('data-testid', 'sendTOKEN');
                            tokenButton.addEventListener('click', async () => {
                                const provider = new ethers.BrowserProvider(createExternalExtensionProvider());
                                const signer = await provider.getSigner();
                                const contractAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
                                // const decimals = 6;
                                const abi = ["function transfer(address to, uint amount)"];
                                const erc20 = new ethers.Contract(contractAddress, abi, signer);

                                erc20.transfer(data.address, '0');
                            });

                            const buttonsDiv = moreButton?.parentElement;

                            const existingETHButton = document.querySelector('[data-testid="sendETH"]');
                            if (existingETHButton) {
                                existingETHButton.replaceWith(ethButton);
                            } else {
                                buttonsDiv?.prepend(ethButton!);
                            }

                            const existingTokenButton = document.querySelector('[data-testid="sendTOKEN"]');
                            if (existingTokenButton) {
                                existingTokenButton.replaceWith(tokenButton);
                            } else {
                                buttonsDiv?.prepend(tokenButton!);
                            }
                          });
                    }
                }
            });
        }
    }
};

const observe = () => {
    mo.observe(document, {
        subtree: true,
        childList: true,
    });
};

const mo = new MutationObserver(onMutation);
observe();
