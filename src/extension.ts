// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios from 'axios';
import * as FormData from 'form-data';

// this method is called when your extension is activated (after startup)
export function activate(context: vscode.ExtensionContext) {
	// Make a diagnostics collection output. Done once when registering the command, so all results go to the same collection,
	// clearing previous results as the tool is subsequently run.
	//
	// See https://code.visualstudio.com/api/references/vscode-api#Diagnostic
	// 	 Severity levels are: Error, Warning, Informational, Hint
	let dcoll = vscode.languages.createDiagnosticCollection('taxi');
	
	// Create the extension UI elements and commands
	const cfg = vscode.workspace.getConfiguration('taxi');

	// Create the status bar element
	let bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
	createStatusBarInput(cfg, context, bar);
	createValidationAction(cfg, context, dcoll, bar);
	createUpdateEDSAction(cfg, context, dcoll, bar);
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	console.log('Extension taxitest.validateEDS is now active. Run from the Command Palette.');
}

// this method is called when your extension is deactivated
export function deactivate() { }

//-----------------------------------------------------------------------------
// Extension command for validating an EDS and displaying the diagnostic output
//-----------------------------------------------------------------------------
function createValidationAction(cfg: vscode.WorkspaceConfiguration, context: vscode.ExtensionContext, dcoll: vscode.DiagnosticCollection, bar: vscode.StatusBarItem) {
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('taxitest.validateEDS', () => validateEmailDesignSystem(cfg, dcoll));
	context.subscriptions.push(disposable);
}

function validateEmailDesignSystem(cfg: vscode.WorkspaceConfiguration, dcoll: vscode.DiagnosticCollection) {
	const startTime = new Date();
	// Gather credentials
	const uri = cfg.get('uri');
	const apiKey = cfg.get('apiKey');
	const keyID = cfg.get('keyId');
	const showSummary = cfg.get('showSummary');
	
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
		url: uri + '/api/v1/eds/check',
		headers: fh,
		data: formData,
	}).then(response => {
		if (response.status === 200) {
			const diags = displayDiagnostics(response.data, doc!.document, startTime, !!showSummary, 'validated');
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
}

// Expected type structure of API response data
export type ResultDetails = {
	type: string,
	message: string,
	details: string,
	element: string,
	line: number,
};

export type Result = {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	total_errors: number,
	// eslint-disable-next-line @typescript-eslint/naming-convention
	total_warnings: number,
	errors: Object,
	warnings: Object,
};

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
		const summary = `At ${endTimeStr}, Taxi for Email ${verb} ${lastLine} lines, found ${result.total_errors} errors, ${result.total_warnings} warnings, in ${duration} seconds.`;
		diags.push(new vscode.Diagnostic(new vscode.Range(lastLine, 0, lastLine, 1), summary, vscode.DiagnosticSeverity.Information));
	}
	return diags;
}

//-----------------------------------------------------------------------------
// Status bar Input item, allowing a selectable Taxi Email Design System ID.
// As the Taxi API cannot currently return the text description of an EDS, we hold
// a text description in the local workspace. This should be eventually removed when
// the API supports description texts.
//-----------------------------------------------------------------------------
function createStatusBarInput(cfg: vscode.WorkspaceConfiguration, context: vscode.ExtensionContext, bar: vscode.StatusBarItem) {
	bar.name = 'Taxi for Email Design System';
	bar.tooltip = 'Taxi for Email Design System';
	bar.command = 'taxitest.setEDS';
	updateEDSBar(bar, cfg.get('designSystemId'), cfg.get('designSystemDescr'), false);
	bar.show();
	
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('taxitest.setEDS', () => setEmailDesignSystemId(cfg, bar));
	context.subscriptions.push(disposable);
}

function setEmailDesignSystemId(cfg: vscode.WorkspaceConfiguration, bar: vscode.StatusBarItem) 
{
	let options: vscode.InputBoxOptions = {
		title: 'Set Email Design System identifier for this workspace',
		prompt: 'Numeric ID; optional description',
		placeHolder: '123456; my new project',
		validateInput(value) {
			var [id, descr] = splitBySemiColon(value);
			return isNumber(id) ? null : 'Must be 0 .. 9';
		},
	};
	
	vscode.window.showInputBox(options).then(value => {
		if (value) {
			var [id, descr] = splitBySemiColon(value);
			const idNum = parseInt(id, 10);
			console.log(`Setting EDS ID = ${idNum}, descr = ${descr}`);
			cfg.update('designSystemId', idNum, vscode.ConfigurationTarget.Workspace).then( () => {
				cfg.update('designSystemDescr', descr, vscode.ConfigurationTarget.Workspace).then( () => {
					updateEDSBar(bar, id, descr, false);
				});
			});
		}
	});
}

function updateEDSBar(bar: vscode.StatusBarItem, id: unknown, descr: unknown, inProgress: boolean) {
	bar.text = 'EDS: ';
	if(id) {
		bar.backgroundColor = new vscode.ThemeColor('statusBarItem.background');
		bar.text += String(id);
		if(descr) {
			bar.text +=  ` ;` + String(descr);		// add optional description
		}
	}
	else {
		bar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
		bar.text += 'Click to set';
	}
	if(inProgress) {
		bar.text += '$(sync~spin)';
	}
}

function isNumber(value: string | number): boolean
{
	return ((value !== null) &&
	(value !== '') &&
	!isNaN(Number(value.toString())));
}

// Split a string that may contain a semicolon
function splitBySemiColon(value: string) {
	var id = '', descr = '';
	if (value.includes(';')) {
		let a = value.split(';', 2); 
		id = a[0];
		descr = a[1];
	} else {
		id = value;
	}
	return [id, descr];
}

//-----------------------------------------------------------------------------
// Extension command to update an existing Email Design System
//-----------------------------------------------------------------------------
function createUpdateEDSAction(cfg: vscode.WorkspaceConfiguration, context: vscode.ExtensionContext, dcoll: vscode.DiagnosticCollection, bar: vscode.StatusBarItem) {
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('taxitest.updateEDS', () => updateEmailDesignSystem(cfg, dcoll, bar));
	context.subscriptions.push(disposable);
}

function updateEmailDesignSystem(cfg: vscode.WorkspaceConfiguration, dcoll: vscode.DiagnosticCollection, bar: vscode.StatusBarItem) {
	const startTime = new Date();
	// Gather credentials and settings
	const uri = cfg.get('uri');
	const apiKey = cfg.get('apiKey');
	const keyID = cfg.get('keyId');
	const showSummary = cfg.get('showSummary');
	const designSystemId = cfg.get('designSystemId');
	const designSystemDescr = cfg.get('designSystemDescr');

	// show "in progress" sync icon
	updateEDSBar(bar, designSystemId, designSystemDescr, true);

	// Get the current text document
	const doc = vscode.window.activeTextEditor;
	if (!doc) {
		vscode.window.showInformationMessage('No active document, skipping Taxi for Email upload.');
		return;
	}
	console.log(`Taxi for Email: sending ${doc!.document.lineCount} lines for upload`);
	const fileName = doc!.document.fileName;
	const docStream = Buffer.from(doc!.document.getText());
	
	// Build the form data for the API call
	// see https://masteringjs.io/tutorials/axios/form-data for why getHeaders() is needed
	// see https://stackoverflow.com/questions/63938473/how-to-create-a-file-from-string-and-send-it-via-formdata for why we need
	//     to convert the current document into a Buffer, so that it gets added to the request as a file, rather than text.
	
	var formData = new FormData();
	formData.append('source', docStream, { filename: fileName }); 	// Note this param is called "source" not "html"
	formData.append('id', designSystemId);
	formData.append('import_images', 'false');
	formData.append('without_review', 'true');						// TODO: check if this is the most useful behaviour
	
	var fh = formData.getHeaders();
	fh['Accept'] = 'application/json';
	fh['X-KEY-ID'] = keyID;
	fh['X-API-KEY'] = apiKey;

	axios({
		method: 'patch',
		url: uri + '/api/v1/eds/update', // TEST 'https://webhook.site/230792c3-4980-4f0a-86b0-fedab9863870'
		headers: fh,
		data: formData,
	}).then(response => {
		if (response.status) {
			if (response.status === 200) {
				if(response.data) {
					const rd = response.data;
					console.log(`Updated ID=${rd.id}, name="${rd.name}", description="${rd.description}", created_at=${rd.created_at}, updated_at=${rd.updated_at}`);
					if(rd.syntax_warnings) {
						// This endpoint returns a different format to "/check", so need to make it similar enough to display
						let result : Result = {
							// eslint-disable-next-line @typescript-eslint/naming-convention
							'total_warnings': Object.values(rd.syntax_warnings).length,
							// eslint-disable-next-line @typescript-eslint/naming-convention
							'total_errors': 0,
							'warnings': rd.syntax_warnings,
							'errors': {},
						};
						const diags = displayDiagnostics(result, doc!.document, startTime, !!showSummary, 'updated');
						dcoll.delete(doc!.document.uri);
						dcoll.set(doc!.document.uri, diags);		
					}
				}
			}
			else {
				// Unexpected response
				const strUnexpected = `Taxi for Email: ${response.status}  - ${response.statusText}`;
				console.log(strUnexpected);
				vscode.window.showErrorMessage(strUnexpected);
			}
		} else {
			console.log(response); // more error handling
		}
	})
	.catch(error => {
		// API has returned an error
		let strError = `Taxi for Email: ${error.response.status} - ${error.response.statusText}`;
		if(error.response.data.message) {
			strError += ` : ${error.response.data.message}`;
		}
		console.log(strError);
		vscode.window.showErrorMessage(strError);
	})
	.finally( () => {
		// remove "in progress" sync icon
		updateEDSBar(bar, designSystemId, designSystemDescr, false);
	});
}
