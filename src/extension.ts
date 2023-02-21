// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// Local project imports
import { cleanupObsoleteWorkspaceSpecificConfig  } from './config';
import { analytics }  from './analytics';
import { createStatusBarInput } from './ui';
import { emailDesignSystemCall } from './eds_api';


// this method is called when your extension is activated (after startup)
export async function activate(context: vscode.ExtensionContext) {
	// Make a diagnostics collection output. Done once when registering the command, so all results go to the same collection,
	// clearing previous results as the tool is subsequently run.
	//
	// See https://code.visualstudio.com/api/references/vscode-api#Diagnostic
	// 	 Severity levels are: Error, Warning, Informational, Hint
	let dcoll = vscode.languages.createDiagnosticCollection('taxi');

	let bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
	createStatusBarInput(context, bar);
	createValidationAction(context, dcoll, bar);
	createUpdateEDSAction(context, dcoll, bar);
	analytics('activate');
	cleanupObsoleteWorkspaceSpecificConfig('designSystemId');
	cleanupObsoleteWorkspaceSpecificConfig('designSystemDescr');

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	console.log('Extension taxitest.validateEDS is now active. Run from the Command Palette.');
}

// this method is called when your extension is deactivated
export function deactivate() {
	analytics('deactivate');
}

//-----------------------------------------------------------------------------
// Extension commands for validating and updating an EDS and displaying the diagnostic output
//-----------------------------------------------------------------------------
function createValidationAction(context: vscode.ExtensionContext, dcoll: vscode.DiagnosticCollection, bar: vscode.StatusBarItem) {
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('taxitest.validateEDS', () =>
		emailDesignSystemCall(dcoll, bar, 'post', '/api/v1/eds/check', 'validate', 'html'));
	context.subscriptions.push(disposable);
}

function createUpdateEDSAction(context: vscode.ExtensionContext, dcoll: vscode.DiagnosticCollection, bar: vscode.StatusBarItem) {
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('taxitest.updateEDS', () =>
		emailDesignSystemCall(dcoll, bar, 'patch', '/api/v1/eds/update', 'update', 'source'));
	context.subscriptions.push(disposable);
}