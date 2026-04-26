import {expect} from 'chai'

import {banner} from '../../dist/ui/banner'
import {MenuChoice} from '../../dist/ui/menu'

describe('orbusctl', () => {
  it('banner contains the logo', () => {
    expect(banner).to.contain('██████')
  })

  it('menu choices are defined', async () => {
    const validChoices: MenuChoice[] = ['config', 'models']
    expect(validChoices).to.have.lengthOf(2)
  })
})
