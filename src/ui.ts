import * as vscode from 'vscode';

// Local project imports
import { Result, ResultDetails } from './eds_actions';

//-----------------------------------------------------------------------------
// Status bar Input item, allowing a selectable Taxi Email Design System ID.
// Taxi API return the text name of an EDS in the response to an update, so we reflect that into
// the local workspace.
//-----------------------------------------------------------------------------
export function createStatusBarDesignSystemIDInput(context: vscode.ExtensionContext, bar: vscode.StatusBarItem) {
    bar.name = 'Taxi EDS';
    bar.tooltip = 'Taxi for Email: Set Design System ID';
    bar.command = 'taxitest.setEDS';
    updateEDSBar(context, bar, '');
    bar.show();

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand(bar.command, () => askForEmailDesignSystemId(context, bar));
    context.subscriptions.push(disposable);
}

const dsListName = 'designSystemIdList';
const maxdsListLen = 20;

export function askForEmailDesignSystemId(context: vscode.ExtensionContext, bar: vscode.StatusBarItem) {
    try {
        let dsList = context.globalState.get(dsListName) as vscode.QuickPickItem[];
        // handle case of nonexistent entries - map to a safe empty list
        if (!dsList) {
            dsList = [];
        }
        const quickPick = vscode.window.createQuickPick();
        quickPick.placeholder = '123456';
        quickPick.canSelectMany = false;
        quickPick.items = dsList;
        quickPick.title = 'Enter a design system ID, or select from list';

        quickPick.onDidChangeValue(() => {
            // remove non-digit characters as invalid
            quickPick.value = quickPick.value.replace(/\D/g, '');

            // if this is a NEW value, add to the original pick list, as the first item
            const labels = quickPick.items.map(i => i.label);
            if (!labels.includes(quickPick.value)) {
                const newItem = { 'label': quickPick.value, 'description': '' };
                quickPick.items = [newItem, ...dsList];
            }
        });

        quickPick.onDidAccept(() => {
            const selection = quickPick.activeItems[0];
            setEmailDesignSystemId(context, bar, selection);
            quickPick.hide();
        });

        quickPick.onDidHide(() => quickPick.dispose());
        quickPick.show();

    } catch (error) {
        console.log(Error);
    }
}

export async function setEmailDesignSystemId(context: vscode.ExtensionContext, bar: vscode.StatusBarItem, value: vscode.QuickPickItem) {
    if (value) {
        try {
            const idNum = parseInt(value.label, 10);
            if (isNaN(idNum)) {
                throw new Error(`Value ${value.label} parsed as NaN`);
            }
            // Get current list of IDs. Append new/chosen value to head of list - maintain in "Most Recently Used" order
            var dsList = context.globalState.get(dsListName);
            // Force a deep copy (ugh!) so we can change the list without messing up the new value
            const newValue = JSON.parse(JSON.stringify(value));
            if (Array.isArray(dsList)) {
                // Already got some entries
                for (let v of dsList) {
                    if (v.label === newValue.label) {
                        // Preserve the existing description, now at the start of the list.
                        // Mark the existing item as blank, for deletion. We can't delete it yet, or it would disrupt the for loop indexing.
                        newValue.description = v.description;
                        v.label = '';
                    }
                }
                // Append newEntry to head. Remove any existing entries now marked for deletion
                // Limit to a max number of entries.
                dsList = [newValue, ...dsList.filter(i => i.label !== '')].slice(0, maxdsListLen);
            }
            else {
                dsList = [newValue];
            }

            // write the list to persistent storage and update the UI
            await context.globalState.update(dsListName, dsList);
            updateEDSBar(context, bar, '');
        } catch (error) {
            console.log(`failure updating ${dsListName}: ${error}`);
        };
    }
}

const maxBarTextLength = 24;

// Reads current design system from top of list
export function updateEDSBar(context: vscode.ExtensionContext, bar: vscode.StatusBarItem, decoration: string): string {
    bar.text = 'EDS ';
    // Refresh the local view from persistent storage
    var dsList = context.globalState.get(dsListName);
    if (Array.isArray(dsList)) {
        const top = dsList[0];
        if(top && top.hasOwnProperty('label')) {
            const designSystemID = top.label;
            bar.backgroundColor = new vscode.ThemeColor('statusBarItem.background');
            bar.text += designSystemID;

            // show optional description
            if (top.hasOwnProperty('description') && top.description) {
                // Bound the description text length, add ellipsis at the end if truncated
                if (top.description.length >= maxBarTextLength) {
                    bar.text += ':' + top.description.slice(0, maxBarTextLength-1) + '…';
                } else {
                    bar.text += ':' + top.description;	// add optional description
                }
    
            }
            bar.text += decoration;
            return designSystemID;
        }
    }
    // Otherwise, show warning color
    bar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    bar.text += 'Click to set';
    return '';
}

export function updateEDSDescription(context: vscode.ExtensionContext, designSystemID: string, description: string) {
    var dsList = context.globalState.get(dsListName);
    if (Array.isArray(dsList)) {
        for (let v of dsList) {
            if (v.label === designSystemID) {
                // Update the existing entry description
                v.description = description;
            }
        }
    }
}

//-----------------------------------------------------------------------------
// Diagnostics output
//-----------------------------------------------------------------------------

export function sanitizeLinebreaks(s: string): string {
    return s.replace(/[\r\n]+/g, ' ');
}

export function makeDiagnostic(d: ResultDetails, doc: vscode.TextDocument): vscode.Diagnostic {
    // Get line number directly from the result details
    var rng = new vscode.Range(0, 0, 0, 100); // default
    if (d.line) {
        // now find out actual length of this line in the doc. VS code lines start from 0 up.
        rng = doc.lineAt(d.line - 1).range;
    }
    // The type string gives the severity - default to "information" unless ERROR or WARN
    var sev = vscode.DiagnosticSeverity.Information;
    switch (d.type.toUpperCase()) {
        case 'WARN':
            sev = vscode.DiagnosticSeverity.Warning;
            break;

        case 'ERROR':
            sev = vscode.DiagnosticSeverity.Error;
            break;
    }
    let diagString = sanitizeLinebreaks(d.message) + ': ' + sanitizeLinebreaks(d.details);
    if (d.element) {
        diagString += '\n' + d.element;
    }
    let diag = new vscode.Diagnostic(rng, diagString, sev);
    diag.source = 'taxi';
    return diag;
}

export function displayDiagnostics(result: Result, doc: vscode.TextDocument, startTime: Date, showSummary: boolean, verb: string): vscode.Diagnostic[] {
    // Iterate through errors and warnings together, as each object has a type attribute
    // concat results into a single array, for ease of iteration
    // verb is a reporting nicety - e.g. "validated", "updated", "created" etc
    let diags: vscode.Diagnostic[] = [];
    // parse errors first, then warnings, as this is the most useful order of presentation
    let combined: ResultDetails[] = Object.values(result.errors).concat(Object.values(result.warnings));
    for (const e of combined) {
        const diag = makeDiagnostic(e, doc);
        diags.push(diag);
    }
    // If enabled, show a final informational diagnostic, showing errors, warnings, and run-time.
    if (showSummary) {
        const lastLine = doc.lineCount;
        const endTime = new Date();
        const endTimeStr = endTime.toLocaleTimeString([], { hour12: false });
        const duration = (endTime.getTime() - startTime.getTime()) / 1000;
        const summary = `At ${endTimeStr}, Taxi for Email ${verb}: ${lastLine} lines, found ${result.total_errors} errors, ${result.total_warnings} warnings, in ${duration} seconds.`;
        diags.push(new vscode.Diagnostic(new vscode.Range(lastLine, 0, lastLine, 1), summary, vscode.DiagnosticSeverity.Information));
    }
    return diags;
}

//-----------------------------------------------------------------------------
// Status bar items, allowing toggle of "import_images" and "without_review" flags.
//-----------------------------------------------------------------------------

// Simple flags, use the text icon to represent the boolean flag state 
const textFlagTrue = '$(pass-filled)';
const textFlagFalse = '$(close)';

export function createStatusBarOptionFlagImportImages(context: vscode.ExtensionContext, bar: vscode.StatusBarItem) {
    bar.name = 'Taxi for Email Design System import_images toggle';
    bar.tooltip = 'Taxi for Email Design System import_images toggle';
    bar.command = 'taxitest.toggle_import_images';
    initBarToggle(bar, '$(eye)' + textFlagTrue);
    bar.show();

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand(bar.command, () => toggleBarFlag(bar));
    context.subscriptions.push(disposable);
}

export function createStatusBarOptionFlagWithoutReview(context: vscode.ExtensionContext, bar: vscode.StatusBarItem) {
    bar.name = 'Taxi for Email Design System without_review toggle';
    bar.tooltip = 'Taxi for Email Design System without_review toggle';
    bar.command = 'taxitest.toggle_without_review';
    initBarToggle(bar, '$(comment-discussion)' + textFlagFalse);
    bar.show();

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand(bar.command, () => toggleBarFlag(bar));
    context.subscriptions.push(disposable);
}

function initBarToggle( bar: vscode.StatusBarItem, txt: string) {
    bar.text = txt;
}

export function barFlagTrue(bar: vscode.StatusBarItem) : boolean {
    return bar.text.includes(textFlagTrue);
}

function toggleBarFlag(bar: vscode.StatusBarItem) {
    if(barFlagTrue(bar)) {
        bar.text = bar.text.replace(textFlagTrue, textFlagFalse);
    } else {
        bar.text = bar.text.replace(textFlagFalse, textFlagTrue);
    }
}