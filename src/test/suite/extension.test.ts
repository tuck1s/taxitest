import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as taxi from '../../extension';
import * as nock from 'nock';

// Calculated expected length of an API result, with/without summary
function expectedLength(result: taxi.Result, summary: boolean): number {
	let combined: taxi.ResultDetails[] = Object.values(result.errors).concat(Object.values(result.warnings));
	var l = 0;
	for (const e of combined) {
		if (typeof e.details === 'string') {
			l += 1;
		} else {
			assert.fail(`Unexpected type ${typeof e.details} found in ${e}`);
		}
	}
	return l + (summary ? 1 : 0); // allow for 1 extra if there's a summary
}


suite('Taxi for Email Validation Extension Test Suite', () => {

	// pre-requisites
	let dcoll = vscode.languages.createDiagnosticCollection('taxi');
	let cfg = vscode.workspace.getConfiguration('taxi');
	let bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
	let doc: vscode.TextDocument;

	suiteSetup(async () => {
		doc = await vscode.workspace.openTextDocument({
			content: 'The quick brown fox'
		});
		const ed = await vscode.window.showTextDocument(doc);
	});

	suiteTeardown(async () => {
		// See https://stackoverflow.com/questions/44733028/how-to-close-textdocument-in-vs-code
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
	});

	vscode.window.showInformationMessage('Start all tests.');

	test('displayDiagnostics - empty, with & without summary', async () => {
		const startTime = new Date();
		const result: taxi.Result = {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			total_errors: 0,
			// eslint-disable-next-line @typescript-eslint/naming-convention
			total_warnings: 0,
			errors: {}, // API returns empty object, rather than zero-length array
			warnings: {},
		};

		var summary = false;
		const diags = taxi.displayDiagnostics(result, doc, startTime, summary, 'test');
		assert.strictEqual(diags.length, expectedLength(result, summary));

		summary = true;
		const diags2 = taxi.displayDiagnostics(result, doc, startTime, summary, 'test');
		assert.strictEqual(diags2.length, expectedLength(result, summary));
	});

	test('displayDiagnostics - errors & warnings, with & without summary', async () => {

		const startTime = new Date();
		const result: taxi.Result = {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			total_errors: 1,
			// eslint-disable-next-line @typescript-eslint/naming-convention
			total_warnings: 2,
			errors: [
				{
					type: 'ERROR',
					message: 'Huge errors found',
					details: 'One problem', // API no longer returns details as an array
					element: 'foo',
					line: 1,
				}
			],
			warnings: [
				{
					type: 'WARN',
					message: 'Some minor problem',
					details: 'A warning',
					element: 'foo',
					line: 1,
				},
				{
					type: 'WARN',
					message: 'Another minor problem',
					details: 'Another warning but with no element or line number',
					// this time without any element or line number
				}
			],
		};

		var summary = false;
		const diags = taxi.displayDiagnostics(result, doc, startTime, summary, 'test');
		assert.strictEqual(diags.length, expectedLength(result, summary));

		summary = true;
		const diags2 = taxi.displayDiagnostics(result, doc, startTime, summary, 'test');
		assert.strictEqual(diags2.length, expectedLength(result, summary));
	});

	test('Email Design System API calls', async () => {
		// Verify
		let s = nock(String(cfg.get('uri')))
			.post('/api/v1/eds/check')
			.reply(200, 'OK');
		taxi.emailDesignSystemCall(dcoll, bar, 'post', '/api/v1/eds/check', 'validate', 'html');

		// Update
		s = nock(String(cfg.get('uri')))
			.patch('/api/v1/eds/update')
			.reply(200, 'OK');
		taxi.emailDesignSystemCall(dcoll, bar, 'patch', '/api/v1/eds/update', 'update', 'source');

		// Unexpected verb
		s = nock(String(cfg.get('uri')))
			.patch('/api/v1/eds/update')
			.reply(200, 'OK');
		taxi.emailDesignSystemCall(dcoll, bar, 'patch', '/api/v1/eds/update', 'flump', 'source');

		// Unexpected response
		s = nock(String(cfg.get('uri')))
			.patch('/api/v1/eds/update')
			.reply(429);
		taxi.emailDesignSystemCall(dcoll, bar, 'patch', '/api/v1/eds/update', 'update', 'source');

		// close active window - error condition
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		s = nock(String(cfg.get('uri')))
			.patch('/api/v1/eds/update')
			.reply(200, 'OK');
		taxi.emailDesignSystemCall(dcoll, bar, 'patch', '/api/v1/eds/update', 'update', 'source');

		// Restore active window afterwards
		doc = await vscode.workspace.openTextDocument({
			content: 'The quick brown fox'
		});
		await vscode.window.showTextDocument(doc);
	});

	test('ID update', async () => {
		taxi.askForEmailDesignSystemId(bar);

		taxi.setEmailDesignSystemId(bar, '123456;my design system');
	});

});
