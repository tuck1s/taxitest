import axios, { Method } from 'axios';
import * as FormData from 'form-data';
import * as vscode from 'vscode';

// Local project imports
import { getTaxiConfig } from './config';
import { updateEDSBar, displayDiagnostics, updateEDSDescription} from './ui';
import { userAgent, analytics } from './analytics';

//-----------------------------------------------------------------------------
// General call handler for Validate and Update, as these are similar
//-----------------------------------------------------------------------------
export function emailDesignSystemCall(context: vscode.ExtensionContext, dcoll: vscode.DiagnosticCollection, bar: vscode.StatusBarItem,
	apiMethod: Method, apiEndpoint: string, verb: string, docAttribute: string): void {
	// Gather credentials and settings. Need to refresh the local config object from persistent storage
	const c = getTaxiConfig();

	const startTime = new Date();
	// show "in progress" sync icon
	const designSystemID = updateEDSBar(context, bar, '$(sync~spin)');

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
		formData.append('id', designSystemID);
		formData.append('import_images', 'false');
		formData.append('without_review', 'true');						// TODO: check if this is the most useful behaviour
	}
	var fh = formData.getHeaders();
	fh['Accept'] = 'application/json';
	fh['X-KEY-ID'] = c.keyID;
	fh['X-API-KEY'] = c.apiKey;
	fh['User-Agent'] = userAgent();
	analytics(c.uri + apiEndpoint);

	axios({
		method: apiMethod,
		url: c.uri + apiEndpoint,
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
						console.log(`Updated ID=${rd.id}, name="${rd.name}"`);
						console.log(`created_at=${rd.created_at}, updated_at=${rd.updated_at}`);
						// Now we have the name - use it as the description on the QuickPicker
						updateEDSDescription(context, designSystemID, rd.name);

						// make result in same form as the Validation call
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
					const diags = displayDiagnostics(result, editor!.document, startTime, c.showSummary, verb);
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
				const diags = displayDiagnostics(result, editor.document, startTime, c.showSummary, verb);
				dcoll.delete(editor.document.uri);
				dcoll.set(editor.document.uri, diags);
			}
			console.log(strError);
			vscode.window.showErrorMessage(strError);
		})
		.finally(() => {
			// remove "in progress" sync icon
			updateEDSBar(context, bar, '');
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