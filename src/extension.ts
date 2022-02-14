// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios from 'axios';
import * as FormData from 'form-data';
import { ConsoleReporter } from '@vscode/test-electron';
import { start } from 'repl';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Extension taxitest.validateEDS is now active. Run from the Command Palette.');

	// Make a diagnostics collection output
	// See https://code.visualstudio.com/api/references/vscode-api#Diagnostic
	// 	 Severity levels are: Error, Warning, Informational, Hint

	let dcoll = vscode.languages.createDiagnosticCollection('taxi');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('taxitest.validateEDS', () => {
		// The code you place here will be executed every time your command is executed

		const startTime = new Date().getTime();

		// Gather credentials
		const cfg = vscode.workspace.getConfiguration();
		const uri = cfg.get('taxi.uri');
		const url = uri + '/api/v1/eds/check';
		const apiKey = cfg.get('taxi.apiKey');
		const keyID = cfg.get('taxi.keyId');

		// Get the current text document
		const doc = vscode.window.activeTextEditor;
		if (doc === undefined) {
			vscode.window.showInformationMessage('No active document, skipping Taxi for Email validation.');
			return;
		}
		console.log('Taxi for Email: sending %d lines for validation', doc!.document.lineCount);
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
					dcoll.clear();
					const nErrors = response.data.total_errors;
					const nWarnings = response.data.total_warnings;

					let diags: vscode.Diagnostic[] = [];
					// Iterate through errors and warnings together, as each object has a type attribute.
					for (let e of Object.values(Object.assign(response.data.errors, response.data.warnings))) {
						var details = '';
						if (typeof e.details === 'string') {
							details = e.details;
						} else {
							details = e.details.join(',');
						}

						// Look for a line number in the details string. If not known, default to first line of file (=0) chars (0,0)->(0,100)
						const regex = /at line ([0-9]+)/;
						const lineNumberMatch = details.match(regex);
						var rng = new vscode.Range(0, 0, 0, 100);
						if (lineNumberMatch !== null) {
							const lineNum = parseInt(lineNumberMatch[1]) - 1; // adjust to be zero-based for VS Code range references
							rng = new vscode.Range(lineNum, 0, lineNum, 100);
						}

						// The type string gives the severity - default to "information" unless ERROR or WARN
						var sev = vscode.DiagnosticSeverity.Information;
						switch (e.type.toUpperCase()) {
							case 'WARN':
								sev = vscode.DiagnosticSeverity.Warning;
								break;

							case 'ERROR':
								sev = vscode.DiagnosticSeverity.Error;
								break;
						}
						let diag = new vscode.Diagnostic(rng, details, sev);
						diag.source = 'taxi';
						diags.push(diag);
					}

					// Add a final informational diagnostic, showing that the check ran successfully
					const lastLine = doc!.document.lineCount;
					const duration = (new Date().getTime() - startTime) / 1000;
					const summary = `Taxi for Email validation: ${lastLine} lines checked, ${nErrors} errors, ${nWarnings} warnings, in ${duration} seconds.`;
					diags.push(new vscode.Diagnostic(new vscode.Range(lastLine, 0, lastLine, 1), summary, vscode.DiagnosticSeverity.Information);
					dcoll.set(doc!.document.uri, diags);
				}
				else {
					// Unexpected response
					const strUnexpected = 'Taxi for Email: ' + response.status.toString() + ' - ' + response.statusText;
					console.log(strUnexpected);
					vscode.window.showErrorMessage(strUnexpected);
				}
			})
			.catch(error => {
				// API has returned an error
				const strError = 'Taxi for Email: ' + error.response.status.toString() + ' - ' + error.response.statusText;
				console.log(strError);
				vscode.window.showErrorMessage(strError);
			});

	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() { }
