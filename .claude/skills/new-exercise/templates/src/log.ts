// log.ts — this lesson's trace events, on top of the shared run log in common/.

import { openRunLog } from "../../../common/log";

// Log/ sits in the exercise folder, next to src/, whatever the cwd.
export const log = openRunLog(new URL("../", import.meta.url));
