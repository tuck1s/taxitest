// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// Local project imports
import { analytics }  from './analytics';
import { createStatusBarDesignSystemIDInput, createStatusBarOptionFlagImportImages, createStatusBarOptionFlagWithoutReview } from './ui';
import { emailDesignSystemCall } from './eds_actions';


// this method is called when your extension is activated (after startup)
export async function activate(context: vscode.ExtensionContext) : Promise<vscode.ExtensionContext> {
	// Make a diagnostics collection output. Done once when registering the command, so all results go to the same collection,
	// clearing previous results as the tool is subsequently run.
	//
	// See https://code.visualstudio.com/api/references/vscode-api#Diagnostic
	// 	 Severity levels are: Error, Warning, Informational, Hint
	let dcoll = vscode.languages.createDiagnosticCollection('taxi');

	let bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
	createStatusBarDesignSystemIDInput(context, bar);

	let barImportImages = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 9);
	createStatusBarOptionFlagImportImages(context, barImportImages);

	let barWithoutReview = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 8);
	createStatusBarOptionFlagWithoutReview(context, barWithoutReview);

	createValidationAction(context, dcoll, bar, barImportImages, barWithoutReview);
	createUpdateEDSAction(context, dcoll, bar,  barImportImages, barWithoutReview);

	analytics('activate', vscode.env.isTelemetryEnabled);
	cleanupObsoleteWorkspaceSpecificConfig('designSystemId');
	cleanupObsoleteWorkspaceSpecificConfig('designSystemDescr');

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	console.log('Extension taxitest.validateEDS is now active. Run from the Command Palette.');

	// return the context just to enable mocha tests
	return context;
}

// this method is called when your extension is deactivated
export function deactivate() {
	analytics('deactivate', vscode.env.isTelemetryEnabled);
}

//-----------------------------------------------------------------------------
// Extension commands for validating and updating an EDS and displaying the diagnostic output
//-----------------------------------------------------------------------------
function createValidationAction(context: vscode.ExtensionContext, dcoll: vscode.DiagnosticCollection, bar: vscode.StatusBarItem, 
	barImportImages: vscode.StatusBarItem, barWithoutReview: vscode.StatusBarItem) {
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('taxitest.validateEDS', () =>
		emailDesignSystemCall(context, dcoll, bar, barImportImages, barWithoutReview, 'post', '/api/v1/eds/check', 'validate', 'html'));
	context.subscriptions.push(disposable);
}

function createUpdateEDSAction(context: vscode.ExtensionContext, dcoll: vscode.DiagnosticCollection, bar: vscode.StatusBarItem,
	barImportImages: vscode.StatusBarItem, barWithoutReview: vscode.StatusBarItem) {
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('taxitest.updateEDS', () =>
		emailDesignSystemCall(context, dcoll, bar,  barImportImages, barWithoutReview, 'patch', '/api/v1/eds/update', 'update', 'source'));
	context.subscriptions.push(disposable);
}

// No longer recording certain items in workspace config as per request from Ben Tweedy
export async function cleanupObsoleteWorkspaceSpecificConfig(id: string) {
    const cfg = vscode.workspace.getConfiguration('taxi');
    if (cfg.get(id)) {
        await cfg.update(id, undefined);
    }
}