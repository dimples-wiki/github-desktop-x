import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

import {
  clearRepositorySectionExtensionsForTests,
  getExtensionForSection,
  getRepositorySectionExtensions,
  getSectionForExtension,
  registerRepositorySection,
  sectionForExtensionIndex,
} from "../../src/lib/extensions/extension-points";
import { builtInExtensions } from "../../src/lib/extensions/built-in-manifest";

const fakeSidebar = {} as any;

function registerAll() {
  for (const entry of builtInExtensions) {
    registerRepositorySection({
      id: entry.id,
      title: entry.title,
      sidebarComponent: fakeSidebar,
      refreshOnActivate: "history",
    });
  }
}

describe("repository section extension registry", () => {
  beforeEach(() => {
    clearRepositorySectionExtensionsForTests();
  });

  it("rejects extensions that are not listed in the manifest", () => {
    assert.throws(
      () =>
        registerRepositorySection({
          id: "not-in-manifest",
          title: "Nope",
          sidebarComponent: fakeSidebar,
        }),
      /must be listed in built-in-manifest/
    );
  });

  it("registers manifest-listed extensions in manifest order", () => {
    registerAll();

    const extensions = getRepositorySectionExtensions();
    assert.strictEqual(extensions.length, builtInExtensions.length);
    assert.deepStrictEqual(
      extensions.map((e) => e.id),
      builtInExtensions.map((e) => e.id)
    );
  });

  it("rejects duplicate registrations", () => {
    registerAll();
    assert.throws(() => registerAll(), /already registered/);
  });

  it("maps between extensions and stable section values", () => {
    registerAll();

    const extensions = getRepositorySectionExtensions();
    extensions.forEach((extension, index) => {
      assert.strictEqual(
        getSectionForExtension(extension),
        sectionForExtensionIndex(index)
      );
      assert.strictEqual(
        getExtensionForSection(sectionForExtensionIndex(index)),
        extension
      );
    });
  });

  it("returns no extension for built-in sections", () => {
    registerAll();
    assert.strictEqual(getExtensionForSection(0 as any), undefined);
    assert.strictEqual(getExtensionForSection(1 as any), undefined);
    assert.strictEqual(getExtensionForSection(999 as any), undefined);
  });
});
