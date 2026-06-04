> Why do I have a folder named `.expo` in my project?
The `.expo` folder is created when an Expo project is started using `expo start` command.
> What do the files contain?
- `devices.json`: contains information about devices that have recently opened this project. This is used to populate the "Development sessions" list in your development builds.
- `types/router.d.ts`: contains TypeScript types for the Expo Router. This file should not be edited and will be overwritten when the project is started.
> Should I commit the `.expo` folder?
No, you should not share the `.expo` folder. It does not need to be shared and would only add confusion.
