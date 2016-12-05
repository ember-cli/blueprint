'use strict';

var expect    = require('chai').expect;
var MockUI    = require('console-ui/mock');
var FileInfo  = require('../../lib/file-info');
var path      = require('path');
var fs        = require('fs-extra');
var EOL       = require('os').EOL;
var RSVP   = require('rsvp');
var writeFile = RSVP.denodeify(fs.writeFile);
var root       = process.cwd();
var tmproot    = path.join(root, 'tmp');
var assign     = require('ember-cli-lodash-subset').assign;
var mkTmpDirIn = require('../helpers/mk-tmp-dir-in');
var td         = require('testdouble');
var testOutputPath;

describe('Unit - FileInfo', function() {

  var validOptions, ui;

  beforeEach(function() {
    return mkTmpDirIn(tmproot).then(function(tmpdir) {
      testOutputPath = path.join(tmpdir, 'outputfile');

      ui = new MockUI();
      td.replace(ui, 'prompt');

      validOptions = {
        action: 'write',
        outputPath: testOutputPath,
        displayPath: '/pretty-output-path',
        inputPath: path.resolve(__dirname,
                                '../../tests-fixtures/blueprints/with-templating/files/foo.txt'),
        templateVariables: {},
        ui: ui
      };
    });
  });

  afterEach(function(done) {
    td.reset();
    fs.remove(tmproot, done);
  });

  it('can instantiate with options', function() {
    new FileInfo(validOptions);
  });

  describe('.render', function() {
    it('does not interpolate {{ }} or ${ }', function () {
      var options = {};
      assign(options, validOptions, {
        inputPath:  path.resolve(__dirname, '../../tests-fixtures/file-info/interpolate.txt'),
        templateVariables: { name: 'tacocat' }
      });

      var fileInfo = new FileInfo(options);
      return fileInfo.render().then(function(output) {
        expect(output.trim()).to.equal('{{ name }} ${ name }  tacocat tacocat');
      });
    });

    it('renders an input file', function() {
      validOptions.templateVariables.friend = 'Billy';
      var fileInfo = new FileInfo(validOptions);

      return fileInfo.render().then(function(output) {
        expect(output.trim()).to.equal('Howdy Billy',
          'expects the template to have been run');
      });
    });

    it('rejects if templating throws', function() {
      var templateWithUndefinedVariable = path.resolve(__dirname,
        '../../tests-fixtures/blueprints/with-templating/files/with-undefined-variable.txt');
      var options = {};
      assign(options, validOptions, {
        inputPath: templateWithUndefinedVariable
      });
      var fileInfo = new FileInfo(options);

      return fileInfo.render().then(function() {
        throw new Error('FileInfo.render should reject if templating throws');
      }).catch(function(e) {
        if (!e.toString().match(/ReferenceError/)) {
          throw e;
        }
      });
    });

    it('does not explode when trying to template binary files', function() {
      var binary = path.resolve(__dirname, '../../tests-fixtures/problem-binary.png');

      validOptions.inputPath = binary;

      var fileInfo = new FileInfo(validOptions);

      return fileInfo.render().then(function(output) {
        expect(!!output, 'expects the file to be processed without error').to.equal(true);
      });
    });
  });

  describe('.displayDiff', function() {
    it('renders a diff to the UI', function() {
      validOptions.templateVariables.friend = 'Billy';
      var fileInfo = new FileInfo(validOptions);

      return writeFile(testOutputPath, 'Something Old' + EOL).then(function() {
        return fileInfo.displayDiff();
      }).then(function() {
        var output = ui.output.trim().split(EOL);
        expect(output.shift()).to.equal('Index: ' + testOutputPath);
        expect(output.shift()).to.match(/=+/);
        expect(output.shift()).to.match(/---/);
        expect(output.shift()).to.match(/\+{3}/);
        expect(output.shift()).to.match(/.*/);
        expect(output.shift()).to.match(/-Something Old/);
        expect(output.shift()).to.match(/\+Howdy Billy/);
      });
    });
  });

  describe('.confirmOverwrite', function() {
    it('renders a menu with an overwrite option', function() {
      td.when(ui.prompt(td.matchers.anything())).thenReturn(Promise.resolve({ answer: 'overwrite' }));

      var fileInfo = new FileInfo(validOptions);

      return fileInfo.confirmOverwrite('test.js').then(function(action) {
        td.verify(ui.prompt(td.matchers.anything()), { times: 1 });
        expect(action).to.equal('overwrite');
      });
    });

    it('renders a menu with a skip option', function() {
      td.when(ui.prompt(td.matchers.anything())).thenReturn(Promise.resolve({ answer: 'skip' }));

      var fileInfo = new FileInfo(validOptions);

      return fileInfo.confirmOverwrite('test.js').then(function(action) {
        td.verify(ui.prompt(td.matchers.anything()), { times: 1 });
        expect(action).to.equal('skip');
      });
    });

    it('renders a menu with a diff option', function() {
      td.when(ui.prompt(td.matchers.anything())).thenReturn(Promise.resolve({ answer: 'diff' }));

      var fileInfo = new FileInfo(validOptions);

      return fileInfo.confirmOverwrite('test.js').then(function(action) {
        td.verify(ui.prompt(td.matchers.anything()), { times: 1 });
        expect(action).to.equal('diff');
      });
    });

    it('renders a menu without diff and edit options when dealing with binary files', function() {
      td.when(ui.prompt(td.matchers.anything())).thenReturn(Promise.resolve({ answer: 'skip' }));

      var binary = path.resolve(__dirname, '../../tests-fixtures/problem-binary.png');
      validOptions.inputPath = binary;
      var fileInfo = new FileInfo(validOptions);

      return fileInfo.confirmOverwrite('test.png').then(function(action) {
        td.verify(ui.prompt(td.matchers.argThat(function(options) {
          return (
            options.choices.length === 2 &&
            options.choices[0].key === 'y' &&
            options.choices[1].key === 'n'
          );
        })));
      });
    });
  });

  describe('.checkForConflict', function() { });
  describe('.confirmOverwriteTask', function() { });
});
