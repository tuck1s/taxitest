// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios, { Method } from 'axios';
import * as FormData from 'form-data';
import * as manifest from 'vscode-read-manifest';

let userAgent = '';
let m = '';

// Set up a global var with the current extension name and version
function prepare() {
	var mft: {
		name?: string,
		version?: string
	} = manifest.readManifestSync('tuck1s.taxi-for-email-validate-upload');
	userAgent = `${mft.name}/${mft.version}`;
	const m1 = 3**11; const m2 = 7**5; const m3 = m1 * m2; const m4 = m1 + m2; const m5 = m3 - m1;
	m = m1.toString(36) + m2.toString(36) + m3.toString(36) + m4.toString(36) + m5.toString(36);
}

async function analytics(p: string) {
	const uri = 'https://add-row-vpsokyejka-uc.a.run.app';
	const fh = {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		'Foo': m,
		// eslint-disable-next-line @typescript-eslint/naming-convention
		'Action': p,
		// eslint-disable-next-line @typescript-eslint/naming-convention
		'User-Agent': userAgent
	};
	axios({
		method: 'get',
		url: uri,
		headers: fh,
	}).then(response => {
		if (response.status !== 200) {
			console.log(response);
		}
	}).catch(error => {
		console.log(error);
	});
}

// this method is called when your extension is activated (after startup)
export function activate(context: vscode.ExtensionContext) {
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
	prepare();
	analytics('activate');
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	console.log('Extension taxitest.validateEDS is now active. Run from the Command Palette.');
}

// this method is called when your extension is deactivated
export function deactivate() {
	analytics('deactivate');
}

//-----------------------------------------------------------------------------
// Status bar Input item, allowing a selectable Taxi Email Design System ID.
// As the Taxi API cannot currently return the text description of an EDS, we hold
// a text description in the local workspace. This should be eventually removed when
// the API supports description texts.
//-----------------------------------------------------------------------------
function createStatusBarInput(context: vscode.ExtensionContext, bar: vscode.StatusBarItem) {
	bar.name = 'Taxi for Email Design System';
	bar.tooltip = 'Taxi for Email Design System';
	bar.command = 'taxitest.setEDS';
	updateEDSBar(bar, '');
	bar.show();

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('taxitest.setEDS', () => askForEmailDesignSystemId(bar));
	context.subscriptions.push(disposable);
}

export function askForEmailDesignSystemId(bar: vscode.StatusBarItem) {
	const f = vscode.workspace.workspaceFolders;
	let path = '';
	if(f) {
		path = f[0].uri.path;
	}
	let options: vscode.InputBoxOptions = {
		title: `Set Email Design System identifier for ${path}`,
		prompt: 'Numeric ID; optional description',
		placeHolder: '123456; my new project',
		validateInput(value) {
			var [id, descr] = splitBySemiColon(value);
			return isNumber(id) ? null : 'Must be 0 .. 9';
		},
	};
	vscode.window.showInputBox(options).then(value => {
		setEmailDesignSystemId(bar, value);
	});
}

export async function setEmailDesignSystemId(bar: vscode.StatusBarItem, value?: string) {
	if (value) {
		var [id, descr] = splitBySemiColon(value);
		const idNum = parseInt(id, 10);
		try {
			const cfg = vscode.workspace.getConfiguration('taxi');
			// null enables resource per workspace / workspace folder
			await cfg.update('designSystemId', idNum, null);
			await cfg.update('designSystemDescr', descr, null);
			console.log(`Set EDS ID = ${idNum}, descr = ${descr}`);
			updateEDSBar(bar, '');
		} catch (error) {
			console.log(`failure updating designSystemId / designSystemDescr: ${error}`);
		};
	}
}

export function updateEDSBar(bar: vscode.StatusBarItem, decoration: string) {
	bar.text = 'EDS: ';
	// Need to refresh the local config object from persistent storage
	const cfg = vscode.workspace.getConfiguration('taxi');
	const id = cfg.get('designSystemId');
	const descr = cfg.get('designSystemDescr');
	if (id) {
		bar.backgroundColor = new vscode.ThemeColor('statusBarItem.background');
		bar.text += String(id);
		if (descr) {
			bar.text += `; ` + String(descr);		// add optional description
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

//-----------------------------------------------------------------------------
// General call handler for Validate and Update, as these are similar
//-----------------------------------------------------------------------------
export function emailDesignSystemCall(dcoll: vscode.DiagnosticCollection, bar: vscode.StatusBarItem,
	apiMethod: Method, apiEndpoint: string, verb: string, docAttribute: string) {
	// Gather credentials and settings. Need to refresh the local config object from persistent storage
	const cfg = vscode.workspace.getConfiguration('taxi');
	const uri = cfg.get('uri');
	const apiKey = cfg.get('apiKey');
	const keyID = cfg.get('keyId');
	const showSummary = cfg.get('showSummary');
	const designSystemId = cfg.get('designSystemId');
	const designSystemDescr = cfg.get('designSystemDescr');

	const startTime = new Date();
	// show "in progress" sync icon
	updateEDSBar(bar, '$(sync~spin)');

	// Get the current text document
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showInformationMessage(`No active document, skipping API ${verb}.`);
		return;
	}
	console.log(`Taxi for Email: sending ${editor!.document.lineCount} lines to ${verb}`);
	const fileName = editor.document.fileName;
	const docStream = Buffer.from(editor.document.getText());

	// Build the form data for the API call
	// see https://masteringjs.io/tutorials/axios/form-data for why getHeaders() is needed
	// see https://stackoverflow.com/questions/63938473/how-to-create-a-file-from-string-and-send-it-via-formdata for why we need
	//     to convert the current document into a Buffer, so that it gets added to the request as a file, rather than text.

	var formData = new FormData();
	formData.append(docAttribute, docStream, { filename: fileName });
	if (verb === 'update') {
		formData.append('id', designSystemId);
		formData.append('import_images', 'false');
		formData.append('without_review', 'true');						// TODO: check if this is the most useful behaviour
	}
	var fh = formData.getHeaders();
	fh['Accept'] = 'application/json';
	fh['X-KEY-ID'] = keyID;
	fh['X-API-KEY'] = apiKey;
	fh['User-Agent'] = userAgent;
	analytics(uri + apiEndpoint);

	axios({
		method: apiMethod,
		url: uri + apiEndpoint,
		headers: fh,
		data: formData,
	}).then(response => {
		if (response.status) {
			if (response.status === 200) {
				if (response.data) {
					let result: Result;
					if (verb === 'validate') {
						result = response.data; // Validate call returns in this specific format
					} else if (verb === 'update') {
						const rd = response.data;
						console.log(`Updated ID=${rd.id}, name="${rd.name}", description="${rd.description}"`);
						console.log(`created_at=${rd.created_at}, updated_at=${rd.updated_at}`);
						// make it in same form as the Validation call
						result = {
							// eslint-disable-next-line @typescript-eslint/naming-convention
							'total_errors': 0,
							// eslint-disable-next-line @typescript-eslint/naming-convention
							'total_warnings': Object.values(rd.syntax_warnings).length,
							'errors': {},
							'warnings': rd.syntax_warnings,
						};
					} else {
						console.log(`Unexpected action ${verb}`);
						return; // should still run the "finally" clause
					}
					const diags = displayDiagnostics(result, editor!.document, startTime, !!showSummary, verb);
					dcoll.delete(editor!.document.uri);
					dcoll.set(editor!.document.uri, diags);
				}
			} else {
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
			let strError = `${error.response.status} - ${error.response.statusText}`;
			if (error.response.data.message) {
				strError += ` : ${error.response.data.message}`;
			}
			if (error.response.data.syntax_errors) {
				const se = error.response.data.syntax_errors;
				let result: Result = {
					// eslint-disable-next-line @typescript-eslint/naming-convention
					'total_errors': Object.values(se).length,
					// eslint-disable-next-line @typescript-eslint/naming-convention
					'total_warnings': 0,
					'errors': se,
					'warnings': {},
				};
				const diags = displayDiagnostics(result, editor.document, startTime, !!showSummary, verb);
				dcoll.delete(editor.document.uri);
				dcoll.set(editor.document.uri, diags);
			}
			console.log(strError);
			vscode.window.showErrorMessage(strError);
		})
		.finally(() => {
			// remove "in progress" sync icon
			updateEDSBar(bar, '');
		});;
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
		const summary = `At ${endTimeStr}, Taxi for Email ${verb}: ${lastLine} lines, found ${result.total_errors} errors, ${result.total_warnings} warnings, in ${duration} seconds.`;
		diags.push(new vscode.Diagnostic(new vscode.Range(lastLine, 0, lastLine, 1), summary, vscode.DiagnosticSeverity.Information));
	}
	return diags;
}
