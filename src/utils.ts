import * as fs from 'fs';

export function dirExists(path: string): Promise<boolean> {
	return new Promise((resolve, reject) => {
		try {
			fs.stat(path, (err, file) => {
				if (!err && file.isDirectory()) {
					return resolve(true);
				} else {
					return resolve(false);
				}
			});
		} catch (err) {
			return reject(false);
		}
	});
}

export const isObject = (item: any): item is object => typeof item === 'object' && item !== null;
