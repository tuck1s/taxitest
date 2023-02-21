import * as vscode from 'vscode';
import { getTaxiConfig } from './config';

//-----------------------------------------------------------------------------
// Status bar Input item, allowing a selectable Taxi Email Design System ID.
// As the Taxi API cannot currently return the text description of an EDS, we hold
// a text description in the local workspace. This should be eventually removed when
// the API supports description texts.
//-----------------------------------------------------------------------------
export function createStatusBarInput(context: vscode.ExtensionContext, bar: vscode.StatusBarItem) {
    bar.name = 'Taxi for Email Design System';
    bar.tooltip = 'Taxi for Email Design System';
    bar.command = 'taxitest.setEDS';
    updateEDSBar(bar, '');
    bar.show();

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('taxitest.setEDS', () => askForEmailDesignSystemId(bar));
    context.subscriptions.push(disposable);
}

export function askForEmailDesignSystemId(bar: vscode.StatusBarItem) {
    let options: vscode.InputBoxOptions = {
        title: `Set Email Design System identifier`,
        prompt: 'Numeric ID',
        placeHolder: '123456',
        validateInput(value) {
            return isNumber(value) ? null : 'Must be 0 .. 9';
        },
    };
    vscode.window.showInputBox(options).then(value => {
        askForImageFolder();
        setEmailDesignSystemId(bar, value);
    });
}

export function askForImageFolder() {
    let items: vscode.QuickPickItem[] = [
        { 'label': 'dogs' },
        { 'label': 'cats' },
        { 'label': 'horses' }
    ];
    vscode.window.showQuickPick(items).then(value => {
        console.log(value);
    });
}

export async function setEmailDesignSystemId(bar: vscode.StatusBarItem, value?: string) {
    if (value) {
        const idNum = parseInt(value, 10);
        try {
            const cfg = vscode.workspace.getConfiguration('taxi');
            // null enables resource per workspace / workspace folder
            await cfg.update('designSystemId', idNum, vscode.ConfigurationTarget.Global);
            console.log(`Set EDS ID = ${idNum}`);
            updateEDSBar(bar, '');
        } catch (error) {
            console.log(`failure updating designSystemId / designSystemDescr: ${error}`);
        };
    }
}

export function updateEDSBar(bar: vscode.StatusBarItem, decoration: string) {
    bar.text = 'EDS: ';
    // Need to refresh the local config object from persistent storage
    const c = getTaxiConfig();
    if (c.designSystemId) {
        bar.backgroundColor = new vscode.ThemeColor('statusBarItem.background');
        bar.text += String(c.designSystemDescr);
        if (c.designSystemDescr) {
            bar.text += `; ` + String(c.designSystemDescr);		// add optional description
        }
    }
    else {
        bar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        bar.text += 'Click to set';
    }
    bar.text += decoration;
}

function isNumber(value: string | number): boolean {
    return ((value !== null) &&
        (value !== '') &&
        !isNaN(Number(value.toString())));
}
