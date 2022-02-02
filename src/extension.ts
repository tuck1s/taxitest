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
		const url = 'https://webhook.site/5f01ca7c-abc4-4192-94b2-d450abc405ac';
		const apiKey = 'f00'; // API key from environment variable. Should have Recipient Validation rights

		// Build the form data for the API call
		var FormData = require('form-data');
		var fs = require('fs');
		var formData = new FormData();
		formData.append('my_file', fs.createReadStream('/Users/stuck/node/taxitest/CHANGELOG.md'));

		axios({
			method: 'post',
			url: url,
			data: formData,
			headers: {
				'Accept': 'application/json',
				'Authorization': apiKey,
			}
		})
			.then((response) => {
				console.log(response.statusText, response.data);
			}, (error) => {
				console.log(error);
			});

		vscode.window.showInformationMessage('Hello World from the Taxi VS Code extension');
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() { }
