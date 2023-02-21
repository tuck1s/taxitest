import * as vscode from 'vscode';
import axios from 'axios';
import * as manifest from 'vscode-read-manifest';

export function userAgent() {
    var mft: {
        name?: string,
        version?: string
    } = manifest.readManifestSync('tuck1s.taxi-for-email-validate-upload');
    return `${mft.name}/${mft.version}`;
}

// ping usage telemetry endpoint
export async function analytics(p: string) {
    if (vscode.env.isTelemetryEnabled) {
        const uri = 'https://add-row-vpsokyejka-uc.a.run.app';
        const m1 = 3 ** 11; const m2 = 7 ** 5; const m3 = m1 * m2; const m4 = m1 + m2; const m5 = m3 - m1;
        const m = m1.toString(36) + m2.toString(36) + m3.toString(36) + m4.toString(36) + m5.toString(36);

        const fh = {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Foo': m,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Action': p,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'User-Agent': userAgent()
        };
        axios({
            method: 'get',
            url: uri,
            headers: fh,
            timeout: 5000,		// don't wait long
            maxRedirects: 0,
        }).then(response => {
            if (response.status !== 200) {
                console.log(response);
            }
        }).catch(error => {
            console.log(error);
        });
    }
}