// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios from 'axios';
import * as FormData from 'form-data';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Extension taxitest.validateEDS is now active. Run from the Command Palette.');

	// Make a diagnostics collection output. Done once when registering the command, so all results go to the same collection,
	// clearing previous results as the tool is subsequently.
	//
	// See https://code.visualstudio.com/api/references/vscode-api#Diagnostic
	// 	 Severity levels are: Error, Warning, Informational, Hint
	let dcoll = vscode.languages.createDiagnosticCollection('taxi');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('taxitest.validateEDS', () => {
		// The code you place here will be executed every time your command is executed

		const startTime = new Date();

		// Gather credentials
		const cfg = vscode.workspace.getConfiguration();
		const uri = cfg.get('taxi.uri');
		const url = uri + '/api/v1/eds/check';
		const apiKey = cfg.get('taxi.apiKey');
		const keyID = cfg.get('taxi.keyId');
		const showSummary = cfg.get('taxi.showSummary');

		// Get the current text document
		const doc = vscode.window.activeTextEditor;
		if (!doc) {
			vscode.window.showInformationMessage('No active document, skipping Taxi for Email validation.');
			return;
		}
		console.log(`Taxi for Email: sending ${doc!.document.lineCount} lines for validation`);
		const fileName = doc!.document.fileName;
		const docStream = Buffer.from(doc!.document.getText());

		// Build the form data for the API call
		// see https://masteringjs.io/tutorials/axios/form-data for why getHeaders() is needed
		// see https://stackoverflow.com/questions/63938473/how-to-create-a-file-from-string-and-send-it-via-formdata for why we need
		//     to convert the current document into a Buffer, so that it gets added to the request as a file, rather than text.

		var formData = new FormData();
		formData.append('html', docStream, { filename: fileName });
		var fh = formData.getHeaders();
		fh['Accept'] = 'application/json';
		fh['X-KEY-ID'] = keyID;
		fh['X-API-KEY'] = apiKey;

		axios({
			method: 'post',
			url: url,
			headers: fh,
			data: formData,
		})
			.then(response => {
				if (response.status === 200) {
					const diags = displayDiagnostics(response.data, doc!.document, startTime, !!showSummary);
					dcoll.delete(doc!.document.uri);
					dcoll.set(doc!.document.uri, diags);
				}
				else {
					// Unexpected response
					const strUnexpected = `Taxi for Email: ${response.status}  - ${response.statusText}`;
					console.log(strUnexpected);
					vscode.window.showErrorMessage(strUnexpected);
				}
			})
			.catch(error => {
				// API has returned an error
				const strError = `Taxi for Email: ${error.response.status} - ${error.response.statusText}`;
				console.log(strError);
				vscode.window.showErrorMessage(strError);
			});
	});
	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() { }


// Expected type structure of API response data
export type ResultDetails = {
	type: string,
	message: string,
	details: string | string[],
};

export type Result = {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	total_errors: number,
	// eslint-disable-next-line @typescript-eslint/naming-convention
	total_warnings: number,
	errors: Object,
	warnings: Object,
};


export function makeDiagnostic(message: string, details: string, type: string): vscode.Diagnostic {
	// Look for a line number in the details string. If not known, default to first line of file (=0) chars (0,0)->(0,100)
	// This feature could be MUCH improved if we can get specific line numbers back from the API
	const regex = /at line ([0-9]+)/;
	const lineNumberMatch = details.match(regex);
	var rng = new vscode.Range(0, 0, 0, 100);
	if (lineNumberMatch !== null) {
		const lineNum = parseInt(lineNumberMatch[1]) - 1; // adjust to be zero-based for VS Code range references
		rng = new vscode.Range(lineNum, 0, lineNum, 100);
	}
	// The type string gives the severity - default to "information" unless ERROR or WARN
	var sev = vscode.DiagnosticSeverity.Information;
	switch (type.toUpperCase()) {
		case 'WARN':
			sev = vscode.DiagnosticSeverity.Warning;
			break;

		case 'ERROR':
			sev = vscode.DiagnosticSeverity.Error;
			break;
	}
	let diag = new vscode.Diagnostic(rng, message + ': ' + details, sev);
	diag.source = 'taxi';
	return diag;
}


export function displayDiagnostics(result: Result, doc: vscode.TextDocument, startTime: Date, showSummary: boolean): vscode.Diagnostic[] {
	// Iterate through errors and warnings together, as each object has a type attribute
	// concat results into a single array, for ease of iteration
	let diags: vscode.Diagnostic[] = [];
	// parse errors first, then warnings, as this is the most useful order of presentation
	let combined: ResultDetails[] = Object.values(result.errors).concat(Object.values(result.warnings));
	for (const e of combined) {
		if (typeof e.details === 'string') {
			const diag = makeDiagnostic(e.message, e.details, e.type);
			diags.push(diag);
		} else if (typeof e.details === 'object') {
			for (const f of e.details) {
				const diag = makeDiagnostic(e.message, f, e.type);
				diags.push(diag);
			}
		}
		else {
			console.log(`Unexpected type ${typeof e.details} found in ${e}`);
		}
	}
	// If enabled, show a final informational diagnostic, showing errors, warnings, and run-time.
	if (showSummary) {
		const lastLine = doc.lineCount;
		const endTime = new Date();
		const endTimeStr = endTime.toLocaleTimeString([], { hour12: false });
		const duration = (endTime.getTime() - startTime.getTime()) / 1000;
		const summary = `At ${endTimeStr}, Taxi for Email validated ${lastLine} lines, found ${result.total_errors} errors, ${result.total_warnings} warnings, in ${duration} seconds.`;
		diags.push(new vscode.Diagnostic(new vscode.Range(lastLine, 0, lastLine, 1), summary, vscode.DiagnosticSeverity.Information));
	}
	return diags;
}