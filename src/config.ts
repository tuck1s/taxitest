import * as vscode from 'vscode';

export type Config = {
    uri: string | undefined,
    apiKey: string | undefined,
    keyID: string | undefined,
    showSummary: boolean,
    designSystemId: string | undefined,
    designSystemDescr: string | undefined,
};

export function getTaxiConfig(): Config {
    const cfg = vscode.workspace.getConfiguration('taxi');

    return {
        uri: cfg.get('uri'),
        apiKey: cfg.get('apiKey'),
        keyID: cfg.get('keyId'),
        showSummary: !!cfg.get('showSummary'),			// solidify the type here
        designSystemId: cfg.get('designSystemId'),
        designSystemDescr: cfg.get('designSystemDescr'),
    };
}

// No longer recording certain items in workspace config as per request from Ben Tweedy
export async function cleanupObsoleteWorkspaceSpecificConfig(id: string) {
    const cfg = vscode.workspace.getConfiguration('taxi');
    if (cfg.get(id) !== undefined) {
        await cfg.update(id, undefined);
    }
}