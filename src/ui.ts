import * as vscode from 'vscode';

// Local project imports
import { getTaxiConfig } from './config';
import { Result, ResultDetails } from './eds_actions';

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
    let disposable = vscode.commands.registerCommand('taxitest.setEDS', () => askForEmailDesignSystemId(context, bar));
    context.subscriptions.push(disposable);
}

const dsListName = 'designSystemIdList';
const maxdsListLen = 20;

export function askForEmailDesignSystemId(context: vscode.ExtensionContext, bar: vscode.StatusBarItem) {
    const dsList = context.globalState.get(dsListName);
    try {
        let items = dsList as vscode.QuickPickItem[];
        let options: vscode.QuickPickOptions = {
            'placeHolder': '123456',
            'title': 'Enter a design system ID, or select from list',
        };
        vscode.window.showQuickPick(items, options).then(value => {
            // setEmailDesignSystemId(context, bar, value);
            console.log(value);
        });
    } catch (error) {
        console.log(Error);
    }
}
/*
        validateInput(value) {
            return isNumber(value) ? null : 'Must be 0 .. 9';
        },
*/

export async function setEmailDesignSystemId(context: vscode.ExtensionContext, bar: vscode.StatusBarItem, value?: string) {
    if (value) {
        try {
            const idNum = parseInt(value, 10);
            if(isNaN(idNum)) {
                throw new Error(`Value ${value} parsed as NaN`);
            }
            const newEntry = { 'label': String(idNum), 'description': '' };

            // Get current list of IDs. Append new/chosen value to head of list - maintain in "Most Recently Used" order
            var dsList = context.globalState.get(dsListName);
            if(Array.isArray(dsList)) {
                // Already got some entries
                for (let v of dsList) {
                    if(v.label === newEntry.label) {
                        // preserve the existing description, now at the top of the list.
                        // mark the existing item placeholder for deletion. We can't delete it yet, or it would disrupt the for loop indexing.
                        newEntry.description = v.description;
                        v.label = '';
                    }
               }
                // Append newEntry to head. Remove any existing entries now marked for deletion
                // Limit to the max number of entries
                dsList = [ newEntry, ... dsList.filter(i => i.label !== '') ].slice(0, maxdsListLen);
            }
            else {
                dsList = [ newEntry ];                
            }
            // debug
            if(Array.isArray(dsList)) {
                for (let v of dsList) {
                    console.log(v.label, v.description);
                }
            }
            context.globalState.update(dsListName, dsList);          
            console.log(`Set EDS ID = ${dsList}`);
            updateEDSBar(bar, '');
        } catch (error) {
            console.log(`failure updating ${dsListName}: ${error}`);
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