package main

import (
    "fmt"
    "strings"
)

type Token struct {
    Text string
    NewLine bool
    Level uint
}

var tokens []Token

type Tag struct {
    Type string
    Id string
    Classes []string
    Attrs map[string]string
}


func main() {
    const test = `
<html <head
    <title Test!
<body
    <h1 class="test" readonly= Hello world! <a href="#" Click
    `

    var tabtest = strings.ReplaceAll(test, "    ", "\t")

    var tokstr = strings.FieldsFunc(tabtest, func(c rune) bool { return c == ' ' })
    for _, t := range(tokstr) {
        if strings.Contains(t, "\n") {
        } else {
            nt := Token {
                t,
                false,
                0,
            }
            tokens = append(tokens, nt)
        }
    }
    for _, t := range(tokens) {
        // if strings.
        fmt.Printf("%q\n", t.Text)
    }
}
