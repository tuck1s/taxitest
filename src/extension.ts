// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios from 'axios';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension taxitest.validateEDS is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('taxitest.validateEDS', () => {
		// The code you place here will be executed every time your command is executed

		// Gather credentials
		const cfg = vscode.workspace.getConfiguration();
		const uri = cfg.get('taxi.uri');
		const url = uri + '/api/v1/eds/check';
		const x_apiKey = cfg.get('taxi.apiKey');
		const x_keyID = cfg.get('taxi.keyId');

		// Get the current text document
		const doc = vscode.window.activeTextEditor;
		if (doc == undefined) {
			vscode.window.showInformationMessage('No active document, skipping Taxi for Email validation.');
			return
		}
		console.log('Taxi for Email: Preparing %d lines for validation', doc!.document.lineCount);
		const fileName = doc!.document.fileName;
		const docStream = Buffer.from(doc!.document.getText());

		// Build the form data for the API call
		// see https://masteringjs.io/tutorials/axios/form-data for why getHeaders() is needed
		// see https://stackoverflow.com/questions/63938473/how-to-create-a-file-from-string-and-send-it-via-formdata for why we need
		//     to convert the current document into a Buffer, so that it gets added to the request as a file type

		var FormData = require('form-data');
		var fs = require('fs');
		var formData = new FormData();
		formData.append('html', docStream, { filename: fileName });
		var fh = formData.getHeaders()
		fh['Accept'] = 'application/json';
		fh['X-KEY-ID'] = x_keyID;
		fh['X-API-KEY'] = x_apiKey;

		axios({
			method: 'post',
			url: url,
			headers: fh,
			data: formData,
		})
			.then(response => {
				console.log(response.statusText, response.data);
			})
			.catch(error => {
				console.log(error.response.status, error.response.data);
			});
		vscode.window.showInformationMessage('Hello World from the Taxi VS Code extension');

	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() { }
