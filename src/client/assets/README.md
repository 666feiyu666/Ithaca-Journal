# Client assets

`src/client/assets/` is the production asset root served by the local application at `/assets/`.

- `scenes/` contains the layered visual-novel scene assets introduced in 0.2.0.
- `room/` is the former 0.1.0 location. It is retained only while older files still need migration; new scene art must not be added there.
- Design references and prompt attachments do not belong in this directory unless they have been cleared and converted into production-ready assets.

See [`scenes/README.md`](scenes/README.md) for the scene asset contract.
