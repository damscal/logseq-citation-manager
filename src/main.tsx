import "@logseq/libs";
import "virtual:windi.css";

import React from "react";
import ReactDOM from "react-dom";
import axios from "axios";
import { logseq as PL } from "../package.json";
import {
  BlockIdentity,
  SettingSchemaDesc,
} from "@logseq/libs/dist/LSPlugin.user";
import * as BibTeXParser from "@retorquere/bibtex-parser";
import SearchBar from "./searchbar";
import { handleClosePopup } from "./handleClosePopup";
const css = (t, ...args) => String.raw(t, ...args);

interface cachedBlock {
  uuid: BlockIdentity;
  originalContent: string;
}

var editAgain = true;
const storageBucket = logseq.Assets.makeSandboxStorage();
const ZOTERO_CACHE_KEY = "zotero_cache.bib";

export const shouldEditAgain = () => {
  return editAgain;
};
export const setEditAgain = () => {
  editAgain = !editAgain;

  setTimeout(() => {
    editAgain = true;
  }, 1000);
};

export const resetEditAgain = () => {
  editAgain = true;
};
export var uuidOriginals = "";
export var originalContentC = "";
export var paperpile = "";
export var paperpileParsed = [];
const pluginId = PL.id;
const settings: SettingSchemaDesc[] = [
  // @ts-expect-error
  {
    key: "bannerHeading",
    title: "Shortcut Settings",
    type: "heading",
  },
  {
    key: "openAsPage",
    title: "Search and open reference as page",
    description: "Shortcut to search and open reference as page",
    default: "mod+shift+o",
    type: "string",
  },
  {
    key: "inlineLitNoteLink",
    title: "Insert inline literature note link",
    description: "Shortcut to insert inline link to literature note",
    default: "mod+shift+i",
    type: "string",
  },
  {
    key: "insertInline",
    title: "Insert inline literature note",
    description: "Shortcut to insert inline literature note",
    default: "mod+shift+l",
    type: "string",
  },
  // @ts-expect-error
  {
    key: "bannerHeading",
    title: "Other settings",
    type: "heading",
  },
  {
    key: "citationReferenceDB",
    title: "Citation DB Name",
    description: "Enter the name of the citation DB (for local file mode). For instructions on how to handle this, check the readme: https://github.com/sawhney17/logseq-citation-manager",
    default: "citationDB.bib",
    type: "string",
  },
  {
    key: "dataSourceType",
    title: "Data Source Type",
    description: "Choose whether to load citations from a local .bib file or from the Zotero Web API.",
    default: "local",
    type: "enum",
    enumChoices: ["local", "zotero"],
    enumPicker: "radio",
  },
  {
    key: "zoteroApiUrl",
    title: "Zotero API URL",
    description: "The Zotero Web API endpoint for your library. Examples: https://api.zotero.org/groups/6186549/items (for a group library) or https://api.zotero.org/users/12345/items (for a personal library). You can also include collection paths like /collections/<collectionKey>/items.",
    default: "",
    type: "string",
  },
  {
    key: "zoteroApiKey",
    title: "Zotero API Key (Optional)",
    description: "Your Zotero API key. Required for accessing non-public libraries. Create one at https://www.zotero.org/settings/keys/new. Leave blank for public group libraries.",
    default: "",
    type: "string",
  },
  {
    key: "zoteroExportFormat",
    title: "Zotero Export Format",
    description: "The format to request from the Zotero API. 'bibtex' is standard BibTeX, 'biblatex' is BibLaTeX (more features).",
    default: "bibtex",
    type: "enum",
    enumChoices: ["bibtex", "biblatex"],
    enumPicker: "radio",
  },
  {
    key: "smartsearch",
    title: "Enable smart search?",
    description:
      "Would you like to enable smart search with fuzzy matching or stick with simple keyword based search?",
    default: false,
    type: "boolean",
  },
  {
    key: "indexAbstracts",
    title: "Enable indexing abstract? (Can impact performance!))",
    description:
      "Would you like to to index abstract in search? This would mean that the search results are prioritized primarily by title, but the contents of the abstract is also taken into consideration.",
    default: false,
    type: "boolean",
  },
  {
    key: "templatePage",
    title: "Template Page",
    description:
      "Enter the name of the template page. On creating a literature note, this page's template will be followed. You can use {type}, {author}, {title}, {journal}, {year}, {volume}, {number}, {pages}, {doi}, {url} and other properties as placeholders",
    default: "",
    type: "string",
  },
  {
    key: "templateBlock",
    title: "Template Block",
    description:
      "Enter the name of the template block, use logseq's in built template feature or smartblocks. To create a template, right click and select make template or use instructions in the smartblocks repo. On inserting inline references, this block's template will be followed. You can use {author}, {title}, {journal}, {year}, {volume}, {number}, {pages}, {doi}, {url} as placeholders",
    default: "",
    type: "string",
  },
  {
    key: "linkAlias",
    title: "Optionally Include Link Aliases",
    description:
      "For inserted links, optionally display an alias to the page. i.e. writing '{author lastname} {year}' would create a link to the actual citation page but it would display as the text you entered below. Leave it blank if aliases are not desired. For more about aliases visit: https://aryansawhney.com/pages/the-ultimate-guide-to-aliases-in-logseq/",
    default: "",
    type: "string",
  },
  {
    key: "pageTitle",
    title: "Page Title",
    description:
      "Enter the template for the title of the page. You can use {author}, {title}, {journal}, {year}, {volume}, {number}, {pages}, {doi}, {url} as placeholders",
    default: "{citekey}",
    type: "string",
  },
  {
    key: "reindexOnStartup",
    title: "Reindex on startup?",
    description:
      " Would you like to reindex the DB on startup? This would mean that the search results stay up to date throughuot but would mean lag on the first search after you restart logseq. Recommended with DBs that have less than 1000 references. You can force reindex through the command pallete",
    default: true,
    type: "boolean",
  },
  {
    key: "fileTemplate",
    title: "Template for File URLS",
    description:
      "If a bibtex entry has a file associated with it, when you call {file++}, this template will be applied to each individual link. Use {fileLink} to refer to the link. You can use {title} and {key} as well. ",
    default: "![{title}](file://{fileLink})",
    type: "string",
  },
  {
    key: "resultsCount",
    title: "Number of results to be returned",
    description:
      "This settings controls the maximum number of results returned by a query. If you find yourself frequently scrolling the matches, you may want to increase this, otherwise you can decrease this.",
    type: "number",
    default: 50,
  },
];

const dispatchPaperpileParse = async (mode, uuid) => {
  if (!logseq.settings.reindexOnStartup) {
    if ((await storageBucket.hasItem("paperpileDB.json")) == true) {
      paperpileParsed = JSON.parse(
        await storageBucket.getItem("paperpileDB.json")
      );
    } else if (logseq.settings.dataSourceType === "zotero" && await storageBucket.hasItem(ZOTERO_CACHE_KEY)) {
      let tempPaperpile = await storageBucket.getItem(ZOTERO_CACHE_KEY);
      tempPaperpile = tempPaperpile.replace(/^\s*crossref\s*=\s*{[^}]*},?\s*$/gm, '');
      paperpile = tempPaperpile;
      const options: BibTeXParser.ParserOptions = {
        errorHandler: (err) => {
          console.warn("Citation plugin: error loading BibLaTeX entry:", err);
        },
      };
      const parsed = BibTeXParser.parse(paperpile, options) as BibTeXParser.Bibliography;
      paperpileParsed = parsed.entries;
    }
  }

  const block = await logseq.Editor.getBlock(uuid);
  if (paperpileParsed.length == 0) {
    logseq.UI.showMsg("No existing DB could be found, reloading DB...");
    getPaperPile();
  } else {
    logseq.Editor.updateBlock(uuid, `inserting...`);
    showDB(paperpileParsed, mode, uuid, block.content);
  }
};
const createDB = (old = false) => {
  const options: BibTeXParser.ParserOptions = {
    errorHandler: (err) => {
      console.warn("Citation plugin: error loading BibLaTeX entry:", err);
    },
  };
  const parsed = BibTeXParser.parse(
    paperpile,
    options
  ) as BibTeXParser.Bibliography;

  paperpileParsed = parsed.entries;

  
    storageBucket.setItem("paperpileDB.json", JSON.stringify(paperpileParsed));
};

const showDB = (parsed, mode, uuid, oc) => {
  editAgain = true;
  paperpileParsed = parsed;
  uuidOriginals = uuid;
  originalContentC = oc;
  ReactDOM.unmountComponentAtNode(document.getElementById("app"));
  ReactDOM.render(
    <React.StrictMode>
      <SearchBar
        paperpileParsed={{
          parse: paperpileParsed,
          currentModeInput: mode,
          currentUuid: uuid,
          originalContent: oc,
        }}
      />
    </React.StrictMode>,
    document.getElementById("app")
  );
  editAgain = true;
  logseq.showMainUI();
  handleClosePopup();
};

const getPaperPile = async () => {
  if (logseq.settings.dataSourceType === "zotero") {
    await getPaperPileFromZotero();
  } else {
    await getPaperPileFromLocal();
  }
};

const getPaperPileFromLocal = async () => {
  if (await storageBucket.hasItem(`${logseq.settings.citationReferenceDB}`)) {
    let tempPaperpile = await storageBucket.getItem(`${logseq.settings.citationReferenceDB}`);
    tempPaperpile = tempPaperpile.replace(/^\s*crossref\s*=\s*{[^}]*},?\s*$/gm, '');
    paperpile = tempPaperpile;
    createDB();
  }
  else {
    logseq.UI.showMsg(
      "Whoops!, Something went wrong when fetching the citation DB. Please check the path and try again. Make sure your database is in the assets folder.",
      "Error",
      { timeout: 5 }
    );
  }
};

const getPaperPileFromZotero = async () => {
  const apiUrl = logseq.settings.zoteroApiUrl?.trim();
  if (!apiUrl) {
    logseq.UI.showMsg(
      "Zotero API URL is not configured. Please set it in the plugin settings.",
      "Error",
      { timeout: 5 }
    );
    return;
  }

  const apiKey = logseq.settings.zoteroApiKey?.trim();
  const exportFormat = logseq.settings.zoteroExportFormat || "bibtex";
  const limit = 100;
  let start = 0;
  let allBibtex = "";
  let totalResults = Infinity;

  try {
    logseq.UI.showMsg("Fetching citations from Zotero API...", "info", { timeout: 2 });

    while (start < totalResults) {
      const separator = apiUrl.includes("?") ? "&" : "?";
      const url = `${apiUrl}${separator}format=${exportFormat}&limit=${limit}&start=${start}`;

      const headers: Record<string, string> = {
        "Zotero-API-Version": "3",
      };
      if (apiKey) {
        headers["Zotero-API-Key"] = apiKey;
      }

      const response = await axios.get(url, {
        headers,
        timeout: 30000,
      });

      const totalResultsHeader = response.headers["total-results"];
      if (totalResultsHeader !== undefined) {
        totalResults = parseInt(totalResultsHeader, 10);
        if (isNaN(totalResults)) {
          totalResults = Infinity;
        }
      }

      const data = response.data;
      if (typeof data === "string") {
        allBibtex += data;
      } else {
        allBibtex += String(data);
      }

      start += limit;

      if (!totalResultsHeader || totalResults === Infinity) {
        if (!data || (typeof data === "string" && data.trim().length === 0)) {
          break;
        }
      }
    }

    if (allBibtex.trim().length === 0) {
      logseq.UI.showMsg(
        "No citations returned from Zotero API. Check your URL and API key.",
        "Warning",
        { timeout: 5 }
      );
      return;
    }

    allBibtex = allBibtex.replace(/^\s*crossref\s*=\s*{[^}]*},?\s*$/gm, '');
    
    await storageBucket.setItem(ZOTERO_CACHE_KEY, allBibtex);
    
    paperpile = allBibtex;
    createDB();
    logseq.UI.showMsg(
      `Successfully loaded ${paperpileParsed.length} citations from Zotero.`,
      "success",
      { timeout: 3 }
    );
  } catch (err) {
    console.error(err);
    let errorMsg = "Failed to fetch from Zotero API.";
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 403) {
        errorMsg = "Zotero API returned 403 Forbidden. Check your API key and permissions.";
      } else if (err.response?.status === 404) {
        errorMsg = "Zotero API URL not found (404). Check the URL in settings.";
      } else if (err.response?.status === 429) {
        errorMsg = "Zotero API rate limit exceeded. Try again later.";
      } else if (err.code === "ECONNABORTED") {
        errorMsg = "Zotero API request timed out.";
      }
    }
    logseq.UI.showMsg(errorMsg, "Error", { timeout: 5 });
  }
};

const getPaperPileFromZoteroCache = async () => {
  if (await storageBucket.hasItem(ZOTERO_CACHE_KEY)) {
    let tempPaperpile = await storageBucket.getItem(ZOTERO_CACHE_KEY);
    tempPaperpile = tempPaperpile.replace(/^\s*crossref\s*=\s*{[^}]*},?\s*$/gm, '');
    paperpile = tempPaperpile;
    createDB();
    logseq.UI.showMsg(
      `Loaded ${paperpileParsed.length} citations from cache.`,
      "success",
      { timeout: 3 }
    );
  } else {
    logseq.UI.showMsg(
      "No cached Zotero data found. Please use 'Reindex Citations DB' to fetch from the API first.",
      "Warning",
      { timeout: 5 }
    );
  }
};
logseq.useSettingsSchema(settings);
function main() {
  storageBucket.setItem("test", "test");
  logseq.setMainUIInlineStyle({
    zIndex: 11,
  });

  logseq.App.registerCommand(
    "openAsPage",
    {
      key: "openedLitNote",
      label: "Search and open reference as page",
      keybinding: { binding: logseq.settings.openAsPage },
    },
    (e) => {
      dispatchPaperpileParse(1, e.uuid);
    }
  );
  logseq.App.registerCommand(
    "insertLink",
    {
      key: "inlineLitNote",
      label: "Create Inline Link to Lit Note",
      keybinding: { binding: logseq.settings.inlineLitNoteLink },
    },
    (e) => {
      dispatchPaperpileParse(2, e.uuid);
    }
  );
  logseq.App.registerCommand(
    "insertInline",
    {
      key: "inlineNote",
      label: "Create Inline Note",
      keybinding: { binding: logseq.settings.insertInline },
    },
    (e) => {
      dispatchPaperpileParse(0, e.uuid);
    }
  );
  logseq.App.registerCommandPalette(
    {
      key: "ReIndex Citations DB",
      label:
        "Reindex the citation DB in case you made changes to your .bib files",
    },
    (e) => {
      getPaperPile();
    }
  );
  logseq.App.registerCommandPalette(
    {
      key: "Load Citations from Cache",
      label:
        "Load citations from local cache without calling the Zotero API",
    },
    (e) => {
      if (logseq.settings.dataSourceType === "zotero") {
        getPaperPileFromZoteroCache();
      } else {
        logseq.UI.showMsg(
          "Cache loading is only available for Zotero data source.",
          "Warning",
          { timeout: 3 }
        );
      }
    }
  );
  logseq.Editor.registerSlashCommand(
    "Create Inline Literature Note",
    async (e) => {
      dispatchPaperpileParse(0, e.uuid);
    }
  );
  logseq.Editor.registerSlashCommand(
    "Create Inline Link to Lit Note",
    async (e) => {
      dispatchPaperpileParse(2, e.uuid);
    }
  );
  logseq.Editor.registerSlashCommand(
    "Search and open reference as page",
    async (e) => {
      dispatchPaperpileParse(1, e.uuid);
    }
  );
}

logseq.ready(main).catch(console.error);
