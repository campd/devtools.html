/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { reportException, assert } = require("devtools/shared/DevToolsUtils");
const { snapshotState: states, actions } = require("../constants");
const { immutableUpdate, L10N, openFilePicker, createSnapshot } = require("../utils");
const { readSnapshot, takeCensus, selectSnapshot } = require("./snapshot");
const { OS } = require("devtools/sham/osfile");
const VALID_EXPORT_STATES = [states.SAVED, states.READ, states.SAVING_CENSUS, states.SAVED_CENSUS];

exports.pickFileAndExportSnapshot = function (snapshot) {
  return function* (dispatch, getState) {
    let outputFile = yield openFilePicker({
      title: L10N.getFormatStr("snapshot.io.save.window"),
      defaultName: OS.Path.basename(snapshot.path),
      filters: [[L10N.getFormatStr("snapshot.io.filter"), "*.fxsnapshot"]],
      mode: "save",
    });

    if (!outputFile) {
      return;
    }

    yield dispatch(exportSnapshot(snapshot, outputFile.path));
  };
};

const exportSnapshot = exports.exportSnapshot = function (snapshot, dest) {
  return function* (dispatch, getState) {

    dispatch({ type: actions.EXPORT_SNAPSHOT_START, snapshot });

    assert(VALID_EXPORT_STATES.includes(snapshot.state),
      `Snapshot is in invalid state for exporting: ${snapshot.state}`);

    try {
      yield OS.File.copy(snapshot.path, dest);
    } catch (error) {
      reportException("exportSnapshot", error);
      dispatch({ type: actions.EXPORT_SNAPSHOT_ERROR, snapshot, error });
    }

    dispatch({ type: actions.EXPORT_SNAPSHOT_END, snapshot });
  };
};

const pickFileAndImportSnapshotAndCensus = exports.pickFileAndImportSnapshotAndCensus = function (heapWorker) {
  return function* (dispatch, getState) {
    let input = yield openFilePicker({
      title: L10N.getFormatStr("snapshot.io.import.window"),
      filters: [[L10N.getFormatStr("snapshot.io.filter"), "*.fxsnapshot"]],
      mode: "open",
    });

    if (!input) {
      return;
    }

    yield dispatch(importSnapshotAndCensus(heapWorker, input.path));
  };
};

const importSnapshotAndCensus = exports.importSnapshotAndCensus = function (heapWorker, path) {
  return function* (dispatch, getState) {
    const snapshot = immutableUpdate(createSnapshot(), {
      path,
      state: states.IMPORTING,
      imported: true,
    });
    const id = snapshot.id;

    dispatch({ type: actions.IMPORT_SNAPSHOT_START, snapshot });
    dispatch(selectSnapshot(snapshot.id));

    try {
      yield dispatch(readSnapshot(heapWorker, id));
      yield dispatch(takeCensus(heapWorker, id));
    } catch (error) {
      reportException("importSnapshot", error);
      dispatch({ type: actions.IMPORT_SNAPSHOT_ERROR, error, id });
    }

    dispatch({ type: actions.IMPORT_SNAPSHOT_END, id });
  };
};
