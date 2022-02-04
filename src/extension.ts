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

	// Make a diagnostics collection output
	// See https://code.visualstudio.com/api/references/vscode-api#Diagnostic
	// 	 Severity levels are: Error, Warning, Informational, Hint

	let dcoll = vscode.languages.createDiagnosticCollection('taxi');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('taxitest.validateEDS', () => {
		// The code you place here will be executed every time your command is executed

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
		console.log('Taxi for Email: ending %d lines for validation', doc!.document.lineCount);
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
					// FIXME: this just generates a single fake warning for now
					let rng = new vscode.Range(5, 5, 5, 6);
					let diag = new vscode.Diagnostic(rng, response.statusText, vscode.DiagnosticSeverity.Warning);
					diag.source = 'taxi';
					diag.code = 999;
					dcoll.set(doc!.document.uri, [diag]);
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
