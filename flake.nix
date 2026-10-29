{
  description = "quickdump — API NestJS + web React, com Postgres local";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_24
            postgresql_17
            prisma_7
            prisma-engines
          ];

          # On NixOS, Prisma needs the schema-engine from nixpkgs;
          # we point the env var here so `npx prisma` works without the wrapper.
          shellHook = ''
            export PRISMA_SCHEMA_ENGINE_BINARY="${pkgs.prisma-engines}/bin/schema-engine"
          '';
        };
      });

      formatter = forAllSystems (pkgs: pkgs.alejandra);
    };
}
