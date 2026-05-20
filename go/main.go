// go/main.go

//go:build js && wasm

package main

import (
	"syscall/js"

	"deauone/auth"
)

func main() {
	c := make(chan struct{}, 0)

	js.Global().Set("goSignJWT", js.FuncOf(signJWT))
	js.Global().Set("goVerifyJWT", js.FuncOf(verifyJWT))
	js.Global().Set("goHashPassword", js.FuncOf(hashPassword))
	js.Global().Set("goVerifyPassword", js.FuncOf(verifyPassword))
	js.Global().Set("goGenerateOTP", js.FuncOf(generateOTP))
	js.Global().Set("goGenerateID", js.FuncOf(generateID))

	<-c
}

func signJWT(this js.Value, args []js.Value) any {
	if len(args) < 2 {
		return js.ValueOf(map[string]any{"error": "missing args"})
	}
	token, err := auth.SignJWT(args[0].String(), args[1].String())
	if err != nil {
		return js.ValueOf(map[string]any{"error": err.Error()})
	}
	return js.ValueOf(map[string]any{"token": token})
}

func verifyJWT(this js.Value, args []js.Value) any {
	if len(args) < 2 {
		return js.ValueOf(map[string]any{"error": "missing args"})
	}
	payload, err := auth.VerifyJWT(args[0].String(), args[1].String())
	if err != nil {
		return js.ValueOf(map[string]any{"error": err.Error()})
	}
	return js.ValueOf(map[string]any{"payload": payload})
}

func hashPassword(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return js.ValueOf(map[string]any{"error": "missing args"})
	}
	hash, err := auth.HashPassword(args[0].String())
	if err != nil {
		return js.ValueOf(map[string]any{"error": err.Error()})
	}
	return js.ValueOf(map[string]any{"hash": hash})
}

func verifyPassword(this js.Value, args []js.Value) any {
	if len(args) < 2 {
		return js.ValueOf(map[string]any{"error": "missing args"})
	}
	ok := auth.VerifyPassword(args[0].String(), args[1].String())
	return js.ValueOf(map[string]any{"ok": ok})
}

func generateOTP(this js.Value, args []js.Value) any {
	code, err := auth.GenerateOTP()
	if err != nil {
		return js.ValueOf(map[string]any{"error": err.Error()})
	}
	return js.ValueOf(map[string]any{"code": code})
}

func generateID(this js.Value, args []js.Value) any {
	id, err := auth.GenerateID()
	if err != nil {
		return js.ValueOf(map[string]any{"error": err.Error()})
	}
	return js.ValueOf(map[string]any{"id": id})
}
