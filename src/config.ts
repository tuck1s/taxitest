import * as vscode from 'vscode';

export type Config = {
    uri: string | undefined,
    apiKey: string | undefined,
    keyID: string | undefined,
    showSummary: boolean,
};

export function getTaxiConfig(): Config {
    const cfg = vscode.workspace.getConfiguration('taxi');

    return {
        uri: cfg.get('uri'),
        apiKey: cfg.get('apiKey'),
        keyID: cfg.get('keyId'),
        showSummary: !!cfg.get('showSummary'),			// solidify the type here
    };
}
