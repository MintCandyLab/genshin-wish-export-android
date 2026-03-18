'use strict'
process.env.NODE_ENV = 'production'

const { say } = require('cfonts')
const { sync } = require('del')
const chalk = require('chalk')
const { build } = require('vite')
const rendererOptions = require('./vite.config.android')

const doneLog = chalk.bgGreen.white(' DONE ') + ' '
const errorLog = chalk.bgRed.white(' ERROR ') + ' '
const okayLog = chalk.bgBlue.white(' OKAY ') + ' '

greeting()
clean()

function clean() {
    sync(['dist/android/*', '!dist/android/.gitkeep'])
    console.log(`\n${doneLog}clear done`)
    buildAndroid()
}

function buildAndroid() {
    build(rendererOptions).then(res => {
        console.log(`\n${okayLog}take it away ${chalk.yellow('`capacitor`')}\n`)
        process.exit()
    }).catch(err => {
        console.log(`\n  ${errorLog}failed to build for android`)
        console.error(`\n${err}\n`)
        process.exit(1)
    })
}

function greeting() {
    const cols = process.stdout.columns
    let text = ''

    if (cols > 85) text = `let's-build`
    else if (cols > 60) text = `let's-|build`
    else text = false

    if (text) {
        say(text, {
            colors: ['yellow'],
            font: 'simple3d',
            space: false
        })
    } else console.log(chalk.yellow.bold(`\n  let's-build`))
    console.log()
}
