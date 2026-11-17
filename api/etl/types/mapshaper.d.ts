declare module "mapshaper" {
  type FileContent = string | Uint8Array;

  const mapshaper: {
    /** Runs mapshaper commands against in-memory input files; resolves with the output files. */
    applyCommands(
      commands: string,
      input?: Record<string, FileContent>,
    ): Promise<Record<string, FileContent>>;
  };

  export default mapshaper;
}
