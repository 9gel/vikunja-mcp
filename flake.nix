{
  description = "Vikunja MCP server development environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
    in {
      devShells.${system}.default = pkgs.mkShell {
        packages = [
          pkgs.nodejs_22
        ];

        shellHook = ''
          export REPO_ROOT=$(git rev-parse --show-toplevel)
        '';
      };
    };
}
